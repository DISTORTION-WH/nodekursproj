/**
 * Unit tests for AuthController methods.
 * All dependencies (DB, email, minio, services) are mocked.
 */

import '../helpers/jwt.helpers'; // sets up config mock
import { mockQuery, resetDb, dbReturns } from '../helpers/db.mock';

// Mock all services used by authController
jest.mock('../../Services/userService');
jest.mock('../../Services/roleService');
jest.mock('../../Services/emailService');
jest.mock('../../Services/minioService');
jest.mock('../../Services/chatService');

import userService from '../../Services/userService';
import roleService from '../../Services/roleService';
import emailService from '../../Services/emailService';
import chatService from '../../Services/chatService';
import authController from '../../Controllers/authController';
import bcrypt from 'bcryptjs';

const userSvc = userService as jest.Mocked<typeof userService>;
const roleSvc = roleService as jest.Mocked<typeof roleService>;
const emailSvc = emailService as jest.Mocked<typeof emailService>;
const chatSvc = chatService as jest.Mocked<typeof chatService>;

function mockReqRes(body = {}, file?: object) {
  const req: any = { body, file, headers: {}, method: 'POST' };
  const res: any = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  const next = jest.fn();
  return { req, res, next };
}

beforeEach(() => {
  jest.clearAllMocks();
  resetDb();
});

// ─── login ────────────────────────────────────────────────────────────────────

describe('AuthController.login', () => {
  it('returns tokens on successful login', async () => {
    const hash = await bcrypt.hash('secret', 10);
    userSvc.findUserByUsername.mockResolvedValue({
      id: 1, username: 'alice', password: hash, is_banned: false, role_id: 1,
    });
    roleSvc.findRoleById.mockResolvedValue({ id: 1, value: 'USER' });

    const { req, res, next } = mockReqRes({ username: 'alice', password: 'secret' });
    await authController.login(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: expect.any(String), refreshToken: expect.any(String) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next with 400 when user not found', async () => {
    userSvc.findUserByUsername.mockResolvedValue(undefined);
    const { req, res, next } = mockReqRes({ username: 'nobody', password: 'x' });
    await authController.login(req, res, next);
    expect(next).toHaveBeenCalled();
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(400);
  });

  it('calls next with 403 when user is banned', async () => {
    userSvc.findUserByUsername.mockResolvedValue({
      id: 2, username: 'banned', password: 'h', is_banned: true,
    });
    const { req, res, next } = mockReqRes({ username: 'banned', password: 'x' });
    await authController.login(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(403);
    expect(err.message).toContain('заблокирован');
  });

  it('calls next with 400 on wrong password', async () => {
    const hash = await bcrypt.hash('correct', 10);
    userSvc.findUserByUsername.mockResolvedValue({
      id: 3, username: 'alice', password: hash, is_banned: false, role_id: 1,
    });
    roleSvc.findRoleById.mockResolvedValue({ id: 1, value: 'USER' });
    const { req, res, next } = mockReqRes({ username: 'alice', password: 'wrong' });
    await authController.login(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(400);
    expect(err.message).toContain('пароль');
  });

  it('returns USER role in token when role_id is missing', async () => {
    const hash = await bcrypt.hash('pass', 10);
    userSvc.findUserByUsername.mockResolvedValue({
      id: 4, username: 'noRole', password: hash, is_banned: false,
    });
    const { req, res, next } = mockReqRes({ username: 'noRole', password: 'pass' });
    await authController.login(req, res, next);
    expect(res.json).toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    expect(payload.user.role).toBe('USER');
  });
});

// ─── refresh ──────────────────────────────────────────────────────────────────

describe('AuthController.refresh', () => {
  it('issues new tokens given a valid refresh token', async () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: 1, role: 'USER' }, 'test-secret-key', { expiresIn: '30d' });
    userSvc.getUserById.mockResolvedValue({ id: 1, is_banned: false } as any);

    const { req, res, next } = mockReqRes({ refreshToken: token });
    await authController.refresh(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: expect.any(String), refreshToken: expect.any(String) })
    );
  });

  it('calls next with 401 when no refresh token provided', async () => {
    const { req, res, next } = mockReqRes({});
    await authController.refresh(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(401);
  });

  it('calls next with 403 when refresh token is expired', async () => {
    const jwt = require('jsonwebtoken');
    const expired = jwt.sign({ id: 1, role: 'USER' }, 'test-secret-key', { expiresIn: '-1s' });
    const { req, res, next } = mockReqRes({ refreshToken: expired });
    await authController.refresh(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(403);
  });

  it('calls next with 403 when refresh token has wrong signature', async () => {
    const jwt = require('jsonwebtoken');
    const bad = jwt.sign({ id: 1, role: 'USER' }, 'other-secret');
    const { req, res, next } = mockReqRes({ refreshToken: bad });
    await authController.refresh(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(403);
  });

  it('blocks refresh for banned user', async () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: 99, role: 'USER' }, 'test-secret-key', { expiresIn: '30d' });
    userSvc.getUserById.mockResolvedValue({ id: 99, is_banned: true } as any);

    const { req, res, next } = mockReqRes({ refreshToken: token });
    await authController.refresh(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(403);
  });
});

// ─── confirmRegistration ──────────────────────────────────────────────────────

describe('AuthController.confirmRegistration', () => {
  const goodPending = {
    email: 'x@y.com', username: 'newuser', password: '$2a$10$hashedpw', avatar_url: null, code: '123456',
  };

  it('creates user and returns tokens on correct code', async () => {
    userSvc.getRegistrationCode.mockResolvedValue(goodPending);
    roleSvc.findRoleByValue.mockResolvedValue({ id: 1, value: 'USER' });
    userSvc.createUser.mockResolvedValue({ id: 10, username: 'newuser' } as any);
    userSvc.deleteRegistrationCode.mockResolvedValue(undefined);
    userSvc.findUserByUsername.mockResolvedValue(undefined); // LumeOfficial not found
    chatSvc.findOrCreatePrivateChat.mockResolvedValue({ id: 5 } as any);
    chatSvc.postMessage.mockResolvedValue(undefined as any);
    dbReturns([]); // INSERT friends

    const { req, res, next } = mockReqRes({ email: 'x@y.com', code: '123456' });
    await authController.confirmRegistration(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: expect.any(String) })
    );
  });

  it('calls next with 400 when no pending registration found', async () => {
    userSvc.getRegistrationCode.mockResolvedValue(undefined);
    const { req, res, next } = mockReqRes({ email: 'no@email.com', code: '000000' });
    await authController.confirmRegistration(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(400);
  });

  it('calls next with 400 on wrong confirmation code', async () => {
    userSvc.getRegistrationCode.mockResolvedValue({ ...goodPending, code: '999999' });
    const { req, res, next } = mockReqRes({ email: 'x@y.com', code: '111111' });
    await authController.confirmRegistration(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(400);
    expect(err.message).toContain('Неверный код');
  });

  it('calls next with 500 when USER role not found in DB', async () => {
    userSvc.getRegistrationCode.mockResolvedValue(goodPending);
    roleSvc.findRoleByValue.mockResolvedValue(undefined);
    const { req, res, next } = mockReqRes({ email: 'x@y.com', code: '123456' });
    await authController.confirmRegistration(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(500);
  });
});

// ─── forgotPassword ───────────────────────────────────────────────────────────

describe('AuthController.forgotPassword', () => {
  it('returns generic success even when email not found (no enumeration)', async () => {
    dbReturns([]); // user not found
    const { req, res, next } = mockReqRes({ email: 'ghost@x.com' });
    await authController.forgotPassword(req, res, next);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Если аккаунт существует') })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('sends code when email exists', async () => {
    dbReturns([{ id: 1 }]); // user found
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // INSERT reset code
    emailSvc.sendVerificationEmail.mockResolvedValue(undefined);
    const { req, res, next } = mockReqRes({ email: 'real@x.com' });
    await authController.forgotPassword(req, res, next);
    expect(emailSvc.sendVerificationEmail).toHaveBeenCalledWith('real@x.com', expect.any(String));
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Код восстановления') })
    );
  });

  it('calls next with 400 when email not provided', async () => {
    const { req, res, next } = mockReqRes({});
    await authController.forgotPassword(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(400);
  });
});

// ─── resetPassword ────────────────────────────────────────────────────────────

describe('AuthController.resetPassword', () => {
  it('resets password with valid unexpired code', async () => {
    const freshDate = new Date(Date.now() - 60_000).toISOString(); // 1 min ago
    dbReturns([{ code: '654321', created_at: freshDate }]); // SELECT reset code
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // UPDATE password
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // DELETE code
    const { req, res, next } = mockReqRes({
      email: 'u@x.com', code: '654321', newPassword: 'NewPass!1',
    });
    await authController.resetPassword(req, res, next);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Пароль') })
    );
  });

  it('rejects expired reset code', async () => {
    const oldDate = new Date(Date.now() - 20 * 60_000).toISOString(); // 20 min ago
    dbReturns([{ code: '654321', created_at: oldDate }]);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // DELETE
    const { req, res, next } = mockReqRes({
      email: 'u@x.com', code: '654321', newPassword: 'New!1',
    });
    await authController.resetPassword(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(400);
    expect(err.message).toContain('истёк');
  });

  it('rejects wrong reset code', async () => {
    const freshDate = new Date(Date.now() - 30_000).toISOString();
    dbReturns([{ code: '111111', created_at: freshDate }]);
    const { req, res, next } = mockReqRes({
      email: 'u@x.com', code: '999999', newPassword: 'New!1',
    });
    await authController.resetPassword(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(400);
    expect(err.message).toContain('Неверный код');
  });

  it('calls next with 400 when no reset code record exists', async () => {
    dbReturns([]);
    const { req, res, next } = mockReqRes({
      email: 'u@x.com', code: '000000', newPassword: 'x',
    });
    await authController.resetPassword(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(400);
  });

  it('calls next with 400 when fields missing', async () => {
    const { req, res, next } = mockReqRes({ email: 'u@x.com' });
    await authController.resetPassword(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(400);
    expect(err.message).toContain('обязательны');
  });
});

// ─── getUsers ─────────────────────────────────────────────────────────────────

describe('AuthController.getUsers', () => {
  it('returns all users', async () => {
    userSvc.getAllUsers.mockResolvedValue([{ id: 1, username: 'a' }] as any);
    const { req, res, next } = mockReqRes();
    await authController.getUsers(req, res, next);
    expect(res.json).toHaveBeenCalledWith([{ id: 1, username: 'a' }]);
  });

  it('calls next when service throws', async () => {
    userSvc.getAllUsers.mockRejectedValue(new Error('DB error'));
    const { req, res, next } = mockReqRes();
    await authController.getUsers(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
