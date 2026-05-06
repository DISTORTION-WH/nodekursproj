/**
 * Integration tests for /chats routes.
 * Real router, mocked DB + chatService + authMiddleware DB checks.
 */

import '../helpers/jwt.helpers';
import { resetDb, dbReturns, mockQuery } from '../helpers/db.mock';
import { makeAccessToken } from '../helpers/jwt.helpers';

jest.mock('../../Services/chatService');
jest.mock('../../Services/minioService');
jest.mock('../../Services/linkPreviewService');

import chatService from '../../Services/chatService';
import request from 'supertest';
import { buildApp } from '../helpers/app';

const chatSvc = chatService as jest.Mocked<typeof chatService>;
const app = buildApp();

function authHeader(userId = 1, role = 'USER') {
  return `Bearer ${makeAccessToken(userId, role)}`;
}

function activeUser(userId = 1) {
  dbReturns([{ is_banned: false }]); // authMiddleware SELECT
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.values(chatSvc).forEach((fn: any) => fn && typeof fn.mockReset === 'function' && fn.mockReset());
  resetDb();
});

// ─── GET /chats ───────────────────────────────────────────────────────────────

describe('GET /chats', () => {
  it('401: no auth header', async () => {
    const res = await request(app).get('/chats');
    expect(res.status).toBe(401);
  });

  it('200: returns user chat list', async () => {
    activeUser();
    chatSvc.getAllUserChats.mockResolvedValue([{ id: 1, name: 'General', is_group: true }] as any);
    const res = await request(app).get('/chats').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─── POST /chats/group ────────────────────────────────────────────────────────

describe('POST /chats/group', () => {
  it('201: creates a group chat', async () => {
    activeUser();
    chatSvc.createGroupChat.mockResolvedValue({ id: 5, name: 'MyGroup', is_group: true } as any);
    const res = await request(app)
      .post('/chats/group')
      .set('Authorization', authHeader())
      .send({ name: 'MyGroup' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('MyGroup');
  });

  it('400: empty name is rejected', async () => {
    activeUser();
    const res = await request(app)
      .post('/chats/group')
      .set('Authorization', authHeader())
      .send({ name: '   ' });
    expect(res.status).toBe(400);
  });

  it('400: name longer than 100 chars', async () => {
    activeUser();
    const res = await request(app)
      .post('/chats/group')
      .set('Authorization', authHeader())
      .send({ name: 'x'.repeat(101) });
    expect(res.status).toBe(400);
  });

  it('401: unauthenticated', async () => {
    const res = await request(app).post('/chats/group').send({ name: 'Group' });
    expect(res.status).toBe(401);
  });
});

// ─── POST /chats/private ─────────────────────────────────────────────────────

describe('POST /chats/private', () => {
  it('200: finds or creates private chat', async () => {
    activeUser();
    chatSvc.findOrCreatePrivateChat.mockResolvedValue({ id: 3, is_group: false } as any);
    const res = await request(app)
      .post('/chats/private')
      .set('Authorization', authHeader(1))
      .send({ friendId: 2 });
    expect(res.status).toBe(200);
  });

  it('401: unauthenticated', async () => {
    const res = await request(app).post('/chats/private').send({ friendId: 2 });
    expect(res.status).toBe(401);
  });
});

// ─── GET /chats/:id/users ─────────────────────────────────────────────────────

describe('GET /chats/:id/users', () => {
  it('200: returns member list', async () => {
    activeUser();
    chatSvc.getChatUsers.mockResolvedValue([
      { id: 1, username: 'alice', chat_role: 'member' },
    ] as any);
    const res = await request(app)
      .get('/chats/10/users')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('403: non-member cannot see chat users', async () => {
    activeUser();
    const err: any = new Error('Нет доступа к этому чату');
    err.status = 403;
    chatSvc.getChatUsers.mockRejectedValue(err);
    const res = await request(app)
      .get('/chats/10/users')
      .set('Authorization', authHeader());
    expect(res.status).toBe(403);
  });
});

// ─── POST /chats/:id/messages ─────────────────────────────────────────────────

describe('POST /chats/:id/messages', () => {
  it('200: sends a text message', async () => {
    activeUser();
    chatSvc.postMessage.mockResolvedValue({ id: 100, text: 'hello', chat_id: 1, sender_id: 1 } as any);
    // @mentions DB query
    dbReturns([]); // SELECT users for mentions
    const res = await request(app)
      .post('/chats/1/messages')
      .set('Authorization', authHeader())
      .send({ text: 'hello' });
    expect([200, 201]).toContain(res.status);
  });

  it('400: empty message text is rejected', async () => {
    activeUser();
    const res = await request(app)
      .post('/chats/1/messages')
      .set('Authorization', authHeader())
      .send({ text: '   ' });
    expect(res.status).toBe(400);
  });

  it('400: missing text field', async () => {
    activeUser();
    const res = await request(app)
      .post('/chats/1/messages')
      .set('Authorization', authHeader())
      .send({});
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /chats/messages/:id ───────────────────────────────────────────────

describe('DELETE /chats/messages/:id', () => {
  it('200: deletes a message when sender requests it', async () => {
    activeUser(1);
    dbReturns([{ role: 'USER' }]); // user role lookup
    dbReturns([{ chat_id: 5, sender_id: 1 }]); // SELECT message — sender matches userId=1
    chatSvc.getChatMemberRole.mockResolvedValue('member');
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // DELETE message
    const res = await request(app)
      .delete('/chats/messages/100')
      .set('Authorization', authHeader(1))
      .send({});
    expect(res.status).toBe(200);
  });
});

// ─── POST /chats/messages/:msgId/react ───────────────────────────────────────

describe('POST /chats/messages/:msgId/react', () => {
  it('200: adds a reaction', async () => {
    activeUser();
    chatSvc.addReaction.mockResolvedValue([{ emoji: '👍', count: 1, users: [1] }] as any);
    dbReturns([{ chat_id: 5 }]); // SELECT chat_id for socket emit
    const res = await request(app)
      .post('/chats/messages/50/react')
      .set('Authorization', authHeader())
      .send({ emoji: '👍' });
    expect(res.status).toBe(200);
  });

  it('400: missing emoji', async () => {
    activeUser();
    const res = await request(app)
      .post('/chats/messages/50/react')
      .set('Authorization', authHeader())
      .send({});
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /chats/messages/:msgId/react ─────────────────────────────────────

describe('DELETE /chats/messages/:msgId/react', () => {
  it('200: removes a reaction', async () => {
    activeUser();
    chatSvc.removeReaction.mockResolvedValue([] as any);
    dbReturns([{ chat_id: 5 }]); // SELECT chat_id for socket emit
    const res = await request(app)
      .delete('/chats/messages/50/react')
      .set('Authorization', authHeader())
      .send({ emoji: '👍' });
    expect(res.status).toBe(200);
  });
});

// ─── POST /chats/:id/invite-code ─────────────────────────────────────────────

describe('POST /chats/:id/invite-code', () => {
  it('201: creates an invite code', async () => {
    activeUser();
    chatSvc.createInviteCode.mockResolvedValue('ab12cd34');
    const res = await request(app)
      .post('/chats/5/invite-code')
      .set('Authorization', authHeader());
    expect(res.status).toBe(201);
    expect(res.body.inviteCode).toBe('ab12cd34');
  });
});

// ─── POST /chats/join ─────────────────────────────────────────────────────────

describe('POST /chats/join', () => {
  it('201: joins chat with valid invite code', async () => {
    activeUser();
    chatSvc.joinWithInviteCode.mockResolvedValue({ id: 7, name: 'Group' } as any);
    const res = await request(app)
      .post('/chats/join')
      .set('Authorization', authHeader())
      .send({ inviteCode: 'ab12cd34' });
    expect(res.status).toBe(201);
  });

  it('404: invalid invite code', async () => {
    activeUser();
    const err: any = new Error('Неверный код приглашения');
    err.status = 404;
    chatSvc.joinWithInviteCode.mockRejectedValue(err);
    const res = await request(app)
      .post('/chats/join')
      .set('Authorization', authHeader())
      .send({ inviteCode: 'badcode' });
    expect(res.status).toBe(404);
  });
});

// ─── POST /chats/:id/invite ───────────────────────────────────────────────────

describe('POST /chats/:id/invite', () => {
  it('200: invites a user to group', async () => {
    activeUser(1);
    dbReturns([{ id: 2 }]); // friendExists check
    dbReturns([{ user_id: 1 }]); // inviter is member
    dbReturns([]); // friend not already in chat
    dbReturns([{ role: 'USER' }]); // inviter global role
    dbReturns([{ creator_id: 1 }]); // inviter is owner of chat
    chatSvc.inviteToGroup.mockResolvedValue(undefined);
    const res = await request(app)
      .post('/chats/5/invite')
      .set('Authorization', authHeader(1))
      .send({ friendId: 2 });
    expect([200, 201]).toContain(res.status);
  });
});

// ─── PATCH /chats/:id/members/:userId/role ────────────────────────────────────

describe('PATCH /chats/:id/members/:userId/role', () => {
  it('403: regular member cannot change roles', async () => {
    activeUser();
    // Requester is 'member', not owner/admin
    dbReturns([{ creator_id: 99 }]); // chat creator is NOT requester
    dbReturns([{ role: 'USER' }]); // global role
    const res = await request(app)
      .patch('/chats/5/members/3/role')
      .set('Authorization', authHeader(1))
      .send({ role: 'moderator' });
    expect(res.status).toBe(403);
  });
});

// ─── GET /chats/:id/pinned ────────────────────────────────────────────────────

describe('GET /chats/:id/pinned', () => {
  it('200: returns pinned messages', async () => {
    activeUser();
    chatSvc.getPinnedMessages.mockResolvedValue([{ id: 1, text: 'Important!' }] as any);
    const res = await request(app)
      .get('/chats/5/pinned')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─── GET /chats/:id/media ─────────────────────────────────────────────────────

describe('GET /chats/:id/media', () => {
  it('200: returns media items', async () => {
    activeUser();
    dbReturns([{ '?column?': 1 }]); // membership check
    dbReturns([{ id: 1, text: 'http://img.com/1.jpg', created_at: new Date().toISOString(), sender_id: 1, sender_name: 'alice' }]);
    const res = await request(app)
      .get('/chats/5/media')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─── GET /chats/:id/export ────────────────────────────────────────────────────

describe('GET /chats/:id/export', () => {
  it('200: returns JSON export of chat', async () => {
    activeUser();
    dbReturns([{ '?column?': 1 }]); // membership check
    dbReturns([{ name: 'General' }]); // chat info
    dbReturns([{ id: 1, text: 'hello', sender_id: 1, created_at: new Date().toISOString(), sender_name: 'alice' }]);
    const res = await request(app)
      .get('/chats/5/export')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
  });
});

// ─── GET /chats/unread ────────────────────────────────────────────────────────

describe('GET /chats/unread', () => {
  it('200: returns unread counts', async () => {
    activeUser();
    chatSvc.getUnreadCounts.mockResolvedValue([{ chat_id: 1, count: 3 }] as any);
    const res = await request(app)
      .get('/chats/unread')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
  });
});
