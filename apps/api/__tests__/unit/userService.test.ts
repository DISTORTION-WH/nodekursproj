/**
 * Unit tests for userService.
 * The pg client is mocked — no real DB needed.
 */

import { mockQuery, resetDb, dbReturns } from '../helpers/db.mock';

// Must be imported AFTER the mock setup above
import userService from '../../Services/userService';
import bcrypt from 'bcryptjs';

beforeEach(() => resetDb());

// ─── findUserByUsername ────────────────────────────────────────────────────────

describe('findUserByUsername', () => {
  it('returns a user when found', async () => {
    const fakeUser = { id: 1, username: 'alice', password: 'hash' };
    dbReturns([fakeUser]);
    const result = await userService.findUserByUsername('alice');
    expect(result).toEqual(fakeUser);
    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT * FROM users WHERE username = $1',
      ['alice']
    );
  });

  it('returns undefined when user not found', async () => {
    dbReturns([]);
    const result = await userService.findUserByUsername('ghost');
    expect(result).toBeUndefined();
  });

  it('propagates DB errors', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB down'));
    await expect(userService.findUserByUsername('x')).rejects.toThrow('DB down');
  });
});

// ─── createUser ───────────────────────────────────────────────────────────────

describe('createUser', () => {
  it('hashes a raw password and inserts the user', async () => {
    const returnedUser = { id: 2, username: 'bob', avatar_url: null };
    dbReturns([returnedUser]);
    const result = await userService.createUser('bob', 'rawPass123', 1);
    expect(result).toEqual(returnedUser);
    // Ensure INSERT was called
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('INSERT INTO users');
    // Stored password should be a bcrypt hash, not raw
    const storedHash = params[1];
    expect(storedHash).toMatch(/^\$2[abxy]\$/);
    expect(await bcrypt.compare('rawPass123', storedHash)).toBe(true);
  });

  it('reuses an already-hashed password without double-hashing', async () => {
    const existingHash = await bcrypt.hash('already', 10);
    dbReturns([{ id: 3, username: 'carol' }]);
    await userService.createUser('carol', existingHash, 1);
    const storedHash = mockQuery.mock.calls[0][1][1];
    expect(storedHash).toBe(existingHash);
  });

  it('throws when password is empty', async () => {
    await expect(userService.createUser('dave', '', 1)).rejects.toThrow(
      'Password must be a non-empty string'
    );
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('includes avatar_url and email when provided', async () => {
    dbReturns([{ id: 4, username: 'eve' }]);
    await userService.createUser('eve', 'pass', 1, 'http://img.com/a.jpg', 'eve@test.com');
    const params = mockQuery.mock.calls[0][1];
    expect(params[3]).toBe('http://img.com/a.jpg');
    expect(params[4]).toBe('eve@test.com');
  });
});

// ─── getAllUsers ───────────────────────────────────────────────────────────────

describe('getAllUsers', () => {
  it('returns list of users', async () => {
    const users = [{ id: 1, username: 'a' }, { id: 2, username: 'b' }];
    dbReturns(users);
    const result = await userService.getAllUsers();
    expect(result).toHaveLength(2);
  });

  it('returns empty array when no users', async () => {
    dbReturns([]);
    const result = await userService.getAllUsers();
    expect(result).toEqual([]);
  });
});

// ─── getUserById ──────────────────────────────────────────────────────────────

describe('getUserById', () => {
  it('returns user with friends attached', async () => {
    const user = { id: 1, username: 'alice' };
    const friends = [{ id: 2, username: 'bob', avatar_url: null }];
    dbReturns([user], friends);
    const result = await userService.getUserById(1);
    expect(result).not.toBeNull();
    expect(result!.friends).toEqual(friends);
  });

  it('returns null when user not found', async () => {
    dbReturns([]);
    const result = await userService.getUserById(999);
    expect(result).toBeNull();
  });

  it('attaches empty friends array when user has no friends', async () => {
    dbReturns([{ id: 1, username: 'alice' }], []);
    const result = await userService.getUserById(1);
    expect(result!.friends).toEqual([]);
  });
});

// ─── changeUserPassword ───────────────────────────────────────────────────────

describe('changeUserPassword', () => {
  it('updates password when old password is correct', async () => {
    const hash = await bcrypt.hash('oldPass', 10);
    dbReturns([{ password: hash }]); // SELECT
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // UPDATE
    await expect(
      userService.changeUserPassword(1, 'oldPass', 'newPass')
    ).resolves.not.toThrow();
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it('throws when old password is wrong', async () => {
    const hash = await bcrypt.hash('correct', 10);
    dbReturns([{ password: hash }]);
    await expect(
      userService.changeUserPassword(1, 'wrong', 'newPass')
    ).rejects.toThrow('Старый пароль неверный');
  });

  it('throws when user not found', async () => {
    dbReturns([]); // empty result
    await expect(
      userService.changeUserPassword(999, 'any', 'new')
    ).rejects.toThrow('Пользователь не найден');
  });
});

// ─── updateUserAvatar ─────────────────────────────────────────────────────────

describe('updateUserAvatar', () => {
  it('runs UPDATE then SELECT and returns updated user', async () => {
    const updatedUser = { id: 1, username: 'alice', avatar_url: 'http://new.png' };
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // UPDATE
    dbReturns([updatedUser]); // SELECT
    const result = await userService.updateUserAvatar(1, 'http://new.png');
    expect(result.avatar_url).toBe('http://new.png');
  });
});

// ─── saveRegistrationCode / getRegistrationCode / deleteRegistrationCode ──────

describe('registration code lifecycle', () => {
  it('saves a registration code without error', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    await expect(
      userService.saveRegistrationCode('x@y.com', 'user', 'hash', null, '123456')
    ).resolves.not.toThrow();
    expect(mockQuery.mock.calls[0][0]).toContain('INSERT INTO registration_codes');
  });

  it('retrieves a pending registration code', async () => {
    const code = { email: 'x@y.com', code: '123456', username: 'user' };
    dbReturns([code]);
    const result = await userService.getRegistrationCode('x@y.com');
    expect(result).toEqual(code);
  });

  it('returns undefined when no code found', async () => {
    dbReturns([]);
    const result = await userService.getRegistrationCode('no@one.com');
    expect(result).toBeUndefined();
  });

  it('deletes a registration code', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    await expect(
      userService.deleteRegistrationCode('x@y.com')
    ).resolves.not.toThrow();
    expect(mockQuery.mock.calls[0][0]).toContain('DELETE FROM registration_codes');
  });
});

// ─── updateUser ───────────────────────────────────────────────────────────────

describe('updateUser', () => {
  it('partially updates user fields', async () => {
    const updated = { id: 1, username: 'new_name', email: 'old@x.com' };
    dbReturns([updated]);
    const result = await userService.updateUser(1, { username: 'new_name' });
    expect(result.username).toBe('new_name');
    const params = mockQuery.mock.calls[0][1];
    expect(params[0]).toBe('new_name');
    expect(params[3]).toBe(1);
  });
});

// ─── deleteUser ───────────────────────────────────────────────────────────────

describe('deleteUser', () => {
  it('executes DELETE query', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    await userService.deleteUser(5);
    expect(mockQuery).toHaveBeenCalledWith('DELETE FROM users WHERE id = $1', [5]);
  });
});

// ─── searchUsers ──────────────────────────────────────────────────────────────

describe('searchUsers', () => {
  it('returns matching users', async () => {
    const users = [{ id: 1, username: 'alice_wonder' }];
    dbReturns(users);
    const result = await userService.searchUsers('alice');
    expect(result).toEqual(users);
    const params = mockQuery.mock.calls[0][1];
    expect(params[0]).toBe('%alice%');
  });

  it('returns empty array when no match', async () => {
    dbReturns([]);
    const result = await userService.searchUsers('zzznobody');
    expect(result).toEqual([]);
  });
});

// ─── updateUserStatus / updateUserTheme / etc. ────────────────────────────────

describe('simple update helpers', () => {
  beforeEach(() => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  });

  it('updateUserStatus calls correct SQL', async () => {
    await userService.updateUserStatus(1, 'away');
    expect(mockQuery).toHaveBeenCalledWith(
      'UPDATE users SET status = $1 WHERE id = $2',
      ['away', 1]
    );
  });

  it('updateUserTheme calls correct SQL', async () => {
    await userService.updateUserTheme(1, 'dark');
    expect(mockQuery).toHaveBeenCalledWith(
      'UPDATE users SET theme = $1 WHERE id = $2',
      ['dark', 1]
    );
  });

  it('updateProfileBg calls correct SQL', async () => {
    await userService.updateProfileBg(1, '#ff0000');
    expect(mockQuery.mock.calls[0][0]).toContain('SET profile_bg');
  });

  it('updateUserAvatarFrame calls correct SQL', async () => {
    await userService.updateUserAvatarFrame(1, 'gold');
    expect(mockQuery.mock.calls[0][0]).toContain('SET avatar_frame');
  });

  it('updateUsernameStyle passes color and anim', async () => {
    await userService.updateUsernameStyle(1, '#fff', 'pulse');
    const params = mockQuery.mock.calls[0][1];
    expect(params[0]).toBe('#fff');
    expect(params[1]).toBe('pulse');
  });

  it('updateProfileExtras passes all 4 fields', async () => {
    await userService.updateProfileExtras(1, 'star', '#blue', 'https://x.com', '#accent');
    const params = mockQuery.mock.calls[0][1];
    expect(params[0]).toBe('star');
    expect(params[1]).toBe('#blue');
    expect(params[2]).toBe('https://x.com');
    expect(params[3]).toBe('#accent');
  });
});
