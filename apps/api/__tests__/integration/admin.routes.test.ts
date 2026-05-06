/**
 * Integration tests for /admin and /moderator routes.
 * Verifies role-based access control and controller logic end-to-end.
 */

import '../helpers/jwt.helpers';
import { resetDb, dbReturns, mockQuery } from '../helpers/db.mock';
import { makeAccessToken } from '../helpers/jwt.helpers';

jest.mock('../../Services/chatService');
jest.mock('../../Services/userService');
jest.mock('../../Services/logService');

import chatService from '../../Services/chatService';
import userService from '../../Services/userService';
import logService from '../../Services/logService';

import request from 'supertest';
import { buildApp } from '../helpers/app';

const chatSvc = chatService as jest.Mocked<typeof chatService>;
const userSvc = userService as jest.Mocked<typeof userService>;
const logSvc = logService as jest.Mocked<typeof logService>;
const app = buildApp();
(app as any).set('io', { to: jest.fn().mockReturnThis(), emit: jest.fn(), in: jest.fn().mockReturnThis(), disconnectSockets: jest.fn() });

function authAs(userId: number, role: string) {
  return `Bearer ${makeAccessToken(userId, role)}`;
}

function activeUser(userId: number, role: string) {
  // Router-level authMiddleware
  dbReturns([{ is_banned: false }]);
  // Router-level roleMiddleware
  dbReturns([{ role }]);
}

function activeUserMod(userId: number, role: string) {
  // Router-level auth + role
  dbReturns([{ is_banned: false }]);
  dbReturns([{ role }]);
  // Route-level auth + role (moderator routes have double middleware)
  dbReturns([{ is_banned: false }]);
  dbReturns([{ role }]);
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.values(chatSvc).forEach((fn: any) => fn && typeof fn.mockReset === 'function' && fn.mockReset());
  Object.values(userSvc).forEach((fn: any) => fn && typeof fn.mockReset === 'function' && fn.mockReset());
  Object.values(logSvc).forEach((fn: any) => fn && typeof fn.mockReset === 'function' && fn.mockReset());
  resetDb();
});

// ─── ACCESS CONTROL: /admin routes ───────────────────────────────────────────

describe('Admin route access control', () => {
  it('401: no auth header on GET /admin/users', async () => {
    const res = await request(app).get('/admin/users');
    expect(res.status).toBe(401);
  });

  it('403: USER role cannot access GET /admin/users', async () => {
    dbReturns([{ is_banned: false }]);
    dbReturns([{ role: 'USER' }]);
    const res = await request(app)
      .get('/admin/users')
      .set('Authorization', authAs(1, 'USER'));
    expect(res.status).toBe(403);
  });

  it('403: MODERATOR cannot access ADMIN-only endpoints', async () => {
    dbReturns([{ is_banned: false }]);
    dbReturns([{ role: 'MODERATOR' }]);
    const res = await request(app)
      .delete('/admin/users/5')
      .set('Authorization', authAs(2, 'MODERATOR'));
    expect(res.status).toBe(403);
  });

  it('200: ADMIN can access GET /admin/users', async () => {
    activeUser(1, 'ADMIN');
    dbReturns([{ id: 1, username: 'alice', role: 'USER' }]);
    const res = await request(app)
      .get('/admin/users')
      .set('Authorization', authAs(1, 'ADMIN'));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('200: ADMIN can access GET /admin/stats', async () => {
    activeUser(1, 'ADMIN');
    // 4 COUNT queries
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '10' }] })
      .mockResolvedValueOnce({ rows: [{ count: '5' }] })
      .mockResolvedValueOnce({ rows: [{ count: '100' }] })
      .mockResolvedValueOnce({ rows: [{ count: '2' }] });
    const res = await request(app)
      .get('/admin/stats')
      .set('Authorization', authAs(1, 'ADMIN'));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('usersCount', 10);
  });
});

// ─── GET /admin/users/search ──────────────────────────────────────────────────

describe('GET /admin/users/search', () => {
  it('200: returns matching users for ADMIN', async () => {
    activeUser(1, 'ADMIN');
    dbReturns([{ id: 2, username: 'alice_w', role: 'USER' }]);
    const res = await request(app)
      .get('/admin/users/search?q=alice')
      .set('Authorization', authAs(1, 'ADMIN'));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('200: returns empty array when q is missing', async () => {
    activeUser(1, 'ADMIN');
    const res = await request(app)
      .get('/admin/users/search')
      .set('Authorization', authAs(1, 'ADMIN'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─── PUT /admin/users/:id ─────────────────────────────────────────────────────

describe('PUT /admin/users/:id', () => {
  it('200: updates user role', async () => {
    activeUser(1, 'ADMIN');
    dbReturns([{ id: 2 }]); // role lookup
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // UPDATE role
    const res = await request(app)
      .put('/admin/users/5')
      .set('Authorization', authAs(1, 'ADMIN'))
      .send({ role: 'MODERATOR' });
    expect(res.status).toBe(200);
  });

  it('200: updates username', async () => {
    activeUser(1, 'ADMIN');
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // UPDATE username
    const res = await request(app)
      .put('/admin/users/5')
      .set('Authorization', authAs(1, 'ADMIN'))
      .send({ username: 'newname' });
    expect(res.status).toBe(200);
  });
});

// ─── DELETE /admin/users/:id ──────────────────────────────────────────────────

describe('DELETE /admin/users/:id', () => {
  it('200: deletes user', async () => {
    activeUser(1, 'ADMIN');
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const res = await request(app)
      .delete('/admin/users/5')
      .set('Authorization', authAs(1, 'ADMIN'));
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deleted');
  });
});

// ─── GET /admin/chats ─────────────────────────────────────────────────────────

describe('GET /admin/chats', () => {
  it('200: returns all chats', async () => {
    activeUser(1, 'ADMIN');
    chatSvc.getAllChats.mockResolvedValue([{ id: 1, name: 'G', is_group: true }] as any);
    const res = await request(app)
      .get('/admin/chats')
      .set('Authorization', authAs(1, 'ADMIN'));
    expect(res.status).toBe(200);
  });
});

// ─── DELETE /admin/chats/:id ──────────────────────────────────────────────────

describe('DELETE /admin/chats/:id', () => {
  it('200: deletes a chat', async () => {
    activeUser(1, 'ADMIN');
    chatSvc.deleteChatAndData.mockResolvedValue(undefined);
    const res = await request(app)
      .delete('/admin/chats/7')
      .set('Authorization', authAs(1, 'ADMIN'));
    expect(res.status).toBe(200);
  });
});

// ─── POST /admin/broadcast ────────────────────────────────────────────────────

describe('POST /admin/broadcast', () => {
  it('400: empty text is rejected', async () => {
    activeUser(1, 'ADMIN');
    const res = await request(app)
      .post('/admin/broadcast')
      .set('Authorization', authAs(1, 'ADMIN'))
      .send({ text: '   ' });
    expect(res.status).toBe(400);
  });

  it('500: system user not found', async () => {
    activeUser(1, 'ADMIN');
    userSvc.findUserByUsername.mockResolvedValue(undefined);
    const res = await request(app)
      .post('/admin/broadcast')
      .set('Authorization', authAs(1, 'ADMIN'))
      .send({ text: 'Hello everyone!' });
    expect(res.status).toBe(500);
  });

  it('200: broadcasts to all users', async () => {
    activeUser(1, 'ADMIN');
    userSvc.findUserByUsername.mockResolvedValue({ id: 99, username: 'LumeOfficial' } as any);
    dbReturns([{ id: 2 }, { id: 3 }]); // all other users
    chatSvc.findOrCreatePrivateChat.mockResolvedValue({ id: 10 } as any);
    chatSvc.postMessage.mockResolvedValue({ id: 1, text: 'msg' } as any);
    const res = await request(app)
      .post('/admin/broadcast')
      .set('Authorization', authAs(1, 'ADMIN'))
      .send({ text: 'Hello everyone!' });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('2');
  });
});

// ─── GET /admin/logs ──────────────────────────────────────────────────────────

describe('GET /admin/logs', () => {
  it('200: returns log entries', async () => {
    activeUser(1, 'ADMIN');
    logSvc.getRecentLogs.mockResolvedValue([{ id: 1, level: 'ERROR', message: 'oops' }] as any);
    const res = await request(app)
      .get('/admin/logs')
      .set('Authorization', authAs(1, 'ADMIN'));
    expect(res.status).toBe(200);
  });
});

// ─── ACCESS CONTROL: /moderator routes ───────────────────────────────────────

describe('Moderator route access control', () => {
  it('401: no token', async () => {
    const res = await request(app).get('/moderator/reports');
    expect(res.status).toBe(401);
  });

  it('403: USER cannot access moderator routes', async () => {
    dbReturns([{ is_banned: false }]);
    dbReturns([{ role: 'USER' }]);
    const res = await request(app)
      .get('/moderator/reports')
      .set('Authorization', authAs(3, 'USER'));
    expect(res.status).toBe(403);
  });

  it('200: MODERATOR can access GET /moderator/reports', async () => {
    activeUserMod(2, 'MODERATOR');
    dbReturns([{ id: 1, reason: 'spam', status: 'pending' }]);
    const res = await request(app)
      .get('/moderator/reports')
      .set('Authorization', authAs(2, 'MODERATOR'));
    expect(res.status).toBe(200);
  });
});

// ─── POST /moderator/warn ─────────────────────────────────────────────────────

describe('POST /moderator/warn', () => {
  it('200: issues warning', async () => {
    activeUser(2, 'MODERATOR');
    dbReturns([{ id: 5 }]); // user exists
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // INSERT warning
    const res = await request(app)
      .post('/moderator/warn')
      .set('Authorization', authAs(2, 'MODERATOR'))
      .send({ userId: 5, reason: 'Spam' });
    expect(res.status).toBe(200);
  });

  it('400: missing userId or reason', async () => {
    activeUser(2, 'MODERATOR');
    const res = await request(app)
      .post('/moderator/warn')
      .set('Authorization', authAs(2, 'MODERATOR'))
      .send({ userId: 5 });
    expect(res.status).toBe(400);
  });

  it('404: user not found', async () => {
    activeUser(2, 'MODERATOR');
    dbReturns([]); // user not found
    const res = await request(app)
      .post('/moderator/warn')
      .set('Authorization', authAs(2, 'MODERATOR'))
      .send({ userId: 999, reason: 'test' });
    expect(res.status).toBe(404);
  });
});

// ─── POST /moderator/ban ──────────────────────────────────────────────────────

describe('POST /moderator/ban', () => {
  it('200: bans a regular user', async () => {
    activeUser(2, 'MODERATOR');
    dbReturns([{ id: 5, role: 'USER' }]); // target user
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // UPDATE banned
    const res = await request(app)
      .post('/moderator/ban')
      .set('Authorization', authAs(2, 'MODERATOR'))
      .send({ userId: 5 });
    expect(res.status).toBe(200);
  });

  it('403: cannot ban another moderator', async () => {
    activeUser(2, 'MODERATOR');
    dbReturns([{ id: 3, role: 'MODERATOR' }]);
    const res = await request(app)
      .post('/moderator/ban')
      .set('Authorization', authAs(2, 'MODERATOR'))
      .send({ userId: 3 });
    expect(res.status).toBe(403);
  });

  it('403: cannot ban an admin', async () => {
    activeUser(2, 'MODERATOR');
    dbReturns([{ id: 1, role: 'ADMIN' }]);
    const res = await request(app)
      .post('/moderator/ban')
      .set('Authorization', authAs(2, 'MODERATOR'))
      .send({ userId: 1 });
    expect(res.status).toBe(403);
  });

  it('400: missing userId', async () => {
    activeUser(2, 'MODERATOR');
    const res = await request(app)
      .post('/moderator/ban')
      .set('Authorization', authAs(2, 'MODERATOR'))
      .send({});
    expect(res.status).toBe(400);
  });

  it('404: target user not found', async () => {
    activeUser(2, 'MODERATOR');
    dbReturns([]); // user not found
    const res = await request(app)
      .post('/moderator/ban')
      .set('Authorization', authAs(2, 'MODERATOR'))
      .send({ userId: 999 });
    expect(res.status).toBe(404);
  });
});

// ─── POST /moderator/unban ────────────────────────────────────────────────────

describe('POST /moderator/unban', () => {
  it('200: unbans user', async () => {
    activeUser(2, 'MODERATOR');
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const res = await request(app)
      .post('/moderator/unban')
      .set('Authorization', authAs(2, 'MODERATOR'))
      .send({ userId: 5 });
    expect(res.status).toBe(200);
  });

  it('400: missing userId', async () => {
    activeUser(2, 'MODERATOR');
    const res = await request(app)
      .post('/moderator/unban')
      .set('Authorization', authAs(2, 'MODERATOR'))
      .send({});
    expect(res.status).toBe(400);
  });
});

// ─── POST /moderator/reports/dismiss ─────────────────────────────────────────

describe('POST /moderator/reports/dismiss', () => {
  it('200: dismisses a report', async () => {
    activeUserMod(2, 'MODERATOR');
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const res = await request(app)
      .post('/moderator/reports/dismiss')
      .set('Authorization', authAs(2, 'MODERATOR'))
      .send({ reportId: 10 });
    expect(res.status).toBe(200);
  });

  it('400: missing reportId', async () => {
    activeUserMod(2, 'MODERATOR');
    const res = await request(app)
      .post('/moderator/reports/dismiss')
      .set('Authorization', authAs(2, 'MODERATOR'))
      .send({});
    expect(res.status).toBe(400);
  });
});

// ─── POST /moderator/delete-message ──────────────────────────────────────────

describe('POST /moderator/delete-message', () => {
  it('200: deletes message and resolves report', async () => {
    activeUserMod(2, 'MODERATOR');
    dbReturns([{ chat_id: 3 }]); // message found
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // DELETE message
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // UPDATE report
    const res = await request(app)
      .post('/moderator/delete-message')
      .set('Authorization', authAs(2, 'MODERATOR'))
      .send({ messageId: 50, reportId: 10 });
    expect(res.status).toBe(200);
  });

  it('400: missing messageId', async () => {
    activeUserMod(2, 'MODERATOR');
    const res = await request(app)
      .post('/moderator/delete-message')
      .set('Authorization', authAs(2, 'MODERATOR'))
      .send({});
    expect(res.status).toBe(400);
  });

  it('404: message not found', async () => {
    activeUserMod(2, 'MODERATOR');
    dbReturns([]); // message not found
    const res = await request(app)
      .post('/moderator/delete-message')
      .set('Authorization', authAs(2, 'MODERATOR'))
      .send({ messageId: 999 });
    expect(res.status).toBe(404);
  });
});
