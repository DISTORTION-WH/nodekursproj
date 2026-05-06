/**
 * Unit tests for ChatService.
 * The pg client is fully mocked.
 */

import { mockQuery, resetDb, dbReturns } from '../helpers/db.mock';
import chatService from '../../Services/chatService';

beforeEach(() => resetDb());

// ─── createGroupChat ──────────────────────────────────────────────────────────

describe('ChatService.createGroupChat', () => {
  it('inserts a new chat and adds creator as member', async () => {
    const chat = { id: 1, name: 'Team Alpha', is_group: true, creator_id: 42 };
    dbReturns([chat]); // INSERT chats RETURNING
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // INSERT chat_users

    const result = await chatService.createGroupChat('Team Alpha', 42);
    expect(result).toEqual(chat);
    expect(mockQuery).toHaveBeenCalledTimes(2);
    const [insertSql] = mockQuery.mock.calls[0];
    expect(insertSql).toContain('INSERT INTO chats');
  });
});

// ─── getChatUsers ─────────────────────────────────────────────────────────────

describe('ChatService.getChatUsers', () => {
  it('returns members when requester is in chat', async () => {
    dbReturns([{ '?column?': 1 }]); // access check
    const members = [
      { id: 1, username: 'alice', chat_role: 'member' },
      { id: 2, username: 'bob', chat_role: 'moderator' },
    ];
    dbReturns(members);
    const result = await chatService.getChatUsers(10, 1);
    expect(result).toHaveLength(2);
  });

  it('throws 403 when requester is not in chat', async () => {
    dbReturns([]); // access check returns nothing
    await expect(chatService.getChatUsers(10, 999)).rejects.toMatchObject({
      status: 403,
    });
  });
});

// ─── getChatMemberRole ────────────────────────────────────────────────────────

describe('ChatService.getChatMemberRole', () => {
  it('returns the chat role of a member', async () => {
    dbReturns([{ chat_role: 'moderator' }]);
    const role = await chatService.getChatMemberRole(10, 2);
    expect(role).toBe('moderator');
  });

  it('returns null when user is not in chat', async () => {
    dbReturns([]);
    const role = await chatService.getChatMemberRole(10, 999);
    expect(role).toBeNull();
  });
});

// ─── setChatMemberRole ────────────────────────────────────────────────────────

describe('ChatService.setChatMemberRole', () => {
  it('updates role successfully', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
    await expect(chatService.setChatMemberRole(1, 2, 'trusted')).resolves.not.toThrow();
  });

  it('throws 400 for invalid role name', async () => {
    await expect(chatService.setChatMemberRole(1, 2, 'superadmin')).rejects.toMatchObject({
      status: 400,
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('throws 404 when user not in chat', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await expect(chatService.setChatMemberRole(1, 999, 'member')).rejects.toMatchObject({
      status: 404,
    });
  });
});

// ─── createInviteCode ─────────────────────────────────────────────────────────

describe('ChatService.createInviteCode', () => {
  it('generates and stores a new invite code for a group', async () => {
    dbReturns([{ id: 5, is_group: true, invite_code: null }]); // SELECT chat
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // UPDATE
    const code = await chatService.createInviteCode(5);
    expect(code).toHaveLength(8); // 4 bytes → 8 hex chars
  });

  it('returns existing invite code without re-generating', async () => {
    dbReturns([{ id: 5, is_group: true, invite_code: 'abc12345' }]);
    const code = await chatService.createInviteCode(5);
    expect(code).toBe('abc12345');
    expect(mockQuery).toHaveBeenCalledTimes(1); // no UPDATE
  });

  it('throws 404 when chat not found', async () => {
    dbReturns([]); // no chat
    await expect(chatService.createInviteCode(999)).rejects.toMatchObject({ status: 404 });
  });

  it('throws 400 for a non-group chat', async () => {
    dbReturns([{ id: 3, is_group: false, invite_code: null }]);
    await expect(chatService.createInviteCode(3)).rejects.toMatchObject({ status: 400 });
  });
});

// ─── joinWithInviteCode ───────────────────────────────────────────────────────

describe('ChatService.joinWithInviteCode', () => {
  it('adds user to chat with valid code', async () => {
    dbReturns([{ id: 7, name: 'Group', is_group: true, creator_id: 1 }]); // find chat
    dbReturns([]); // not already in chat
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // INSERT
    const chat = await chatService.joinWithInviteCode('validcode', 10);
    expect(chat.id).toBe(7);
  });

  it('throws 404 for invalid invite code', async () => {
    dbReturns([]); // no chat found
    await expect(chatService.joinWithInviteCode('badcode', 10)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('throws 400 when user already in chat', async () => {
    dbReturns([{ id: 7, is_group: true, creator_id: 1 }]); // chat found
    dbReturns([{ '?column?': 1 }]); // already member
    await expect(chatService.joinWithInviteCode('code', 10)).rejects.toMatchObject({
      status: 400,
    });
  });
});

// ─── kickFromGroup ────────────────────────────────────────────────────────────

describe('ChatService.kickFromGroup', () => {
  it('executes DELETE on chat_users', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    await chatService.kickFromGroup(10, 5);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('DELETE FROM chat_users');
    expect(params).toEqual([10, 5]);
  });
});

// ─── inviteToGroup ────────────────────────────────────────────────────────────

describe('ChatService.inviteToGroup', () => {
  it('inserts member into chat_users', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    await chatService.inviteToGroup(10, 5, 1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('INSERT INTO chat_users');
    expect(params).toEqual([10, 5, 1]);
  });
});

// ─── getAllUserChats ───────────────────────────────────────────────────────────

describe('ChatService.getAllUserChats', () => {
  it('returns list of chats for user', async () => {
    const chats = [{ id: 1, name: 'g', is_group: true }, { id: 2, name: null, is_group: false }];
    dbReturns(chats);
    const result = await chatService.getAllUserChats(3);
    expect(result).toHaveLength(2);
  });

  it('returns empty when user has no chats', async () => {
    dbReturns([]);
    const result = await chatService.getAllUserChats(999);
    expect(result).toEqual([]);
  });
});

// ─── deleteMessagesByChat ─────────────────────────────────────────────────────

describe('ChatService.deleteMessagesByChat', () => {
  it('sends DELETE query with correct chatId', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 5 });
    await chatService.deleteMessagesByChat(7);
    expect(mockQuery).toHaveBeenCalledWith('DELETE FROM messages WHERE chat_id = $1', [7]);
  });
});

// ─── deleteChatAndData ────────────────────────────────────────────────────────

describe('ChatService.deleteChatAndData', () => {
  it('runs a transaction: BEGIN → delete messages → delete chat_users → delete chat → COMMIT', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    await chatService.deleteChatAndData(3);
    const sqls = mockQuery.mock.calls.map((c: any[]) => c[0]);
    expect(sqls[0]).toBe('BEGIN');
    expect(sqls).toContain('DELETE FROM messages WHERE chat_id = $1');
    expect(sqls).toContain('DELETE FROM chat_users WHERE chat_id = $1');
    expect(sqls).toContain('DELETE FROM chats WHERE id = $1');
    expect(sqls[sqls.length - 1]).toBe('COMMIT');
  });

  it('rolls back on error', async () => {
    mockQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockRejectedValueOnce(new Error('fk violation')); // DELETE messages
    mockQuery.mockResolvedValue(undefined); // ROLLBACK
    await expect(chatService.deleteChatAndData(9)).rejects.toThrow('fk violation');
    const sqls = mockQuery.mock.calls.map((c: any[]) => c[0]);
    expect(sqls).toContain('ROLLBACK');
  });
});

// ─── findOrCreatePrivateChat ──────────────────────────────────────────────────

describe('ChatService.findOrCreatePrivateChat', () => {
  it('returns existing private chat when found', async () => {
    dbReturns([{ id: 20, is_group: false }]); // existing
    const result = await chatService.findOrCreatePrivateChat(1, 2);
    expect(result.id).toBe(20);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('creates a new private chat when not found', async () => {
    dbReturns([]); // no existing chat
    dbReturns([{ id: 21, is_group: false }]); // INSERT chats
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // INSERT chat_users user1
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // INSERT chat_users user2
    const result = await chatService.findOrCreatePrivateChat(1, 2);
    expect(result.id).toBe(21);
  });
});

// ─── getChatMemberRole edge cases ─────────────────────────────────────────────

describe('ChatService.getChatMemberRole — allowed role values', () => {
  const validRoles = ['member', 'trusted', 'moderator'];
  validRoles.forEach((r) => {
    it(`accepts role "${r}" in setChatMemberRole`, async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
      await expect(chatService.setChatMemberRole(1, 2, r)).resolves.not.toThrow();
    });
  });
});

// ─── getAllChats (admin) ───────────────────────────────────────────────────────

describe('ChatService.getAllChats', () => {
  it('returns all chats with participant aggregates', async () => {
    const chats = [
      { id: 1, name: 'General', is_group: true, participants: [{ id: 1, username: 'a' }] },
    ];
    dbReturns(chats);
    const result = await chatService.getAllChats();
    expect(result).toHaveLength(1);
    expect(result[0].participants).toBeDefined();
  });
});
