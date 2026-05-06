/**
 * Integration tests for /auth routes using supertest.
 * The real Express router + controllers are used; only DB and external services are mocked.
 */

import '../helpers/jwt.helpers';
import { resetDb, dbReturns, mockQuery } from '../helpers/db.mock';
import { makeAccessToken } from '../helpers/jwt.helpers';

jest.mock('../../Services/userService');
jest.mock('../../Services/roleService');
jest.mock('../../Services/emailService');
jest.mock('../../Services/minioService');
jest.mock('../../Services/chatService');

import userService from '../../Services/userService';
import roleService from '../../Services/roleService';
import emailService from '../../Services/emailService';
import chatService from '../../Services/chatService';

import request from 'supertest';
import { buildApp } from '../helpers/app';
import bcrypt from 'bcryptjs';

const userSvc = userService as jest.Mocked<typeof userService>;
const roleSvc = roleService as jest.Mocked<typeof roleService>;
const emailSvc = emailService as jest.Mocked<typeof emailService>;
const chatSvc = chatService as jest.Mocked<typeof chatService>;

const app = buildApp();

beforeEach(() => {
  jest.clearAllMocks();
  userSvc.findUserByUsername.mockReset();
  userSvc.getUserById.mockReset();
  userSvc.getRegistrationCode.mockReset();
  userSvc.saveRegistrationCode.mockReset();
  userSvc.createUser.mockReset();
  userSvc.deleteRegistrationCode.mockReset();
  userSvc.getAllUsers.mockReset();
  roleSvc.findRoleById.mockReset();
  roleSvc.findRoleByValue.mockReset();
  emailSvc.sendVerificationEmail.mockReset();
  chatSvc.findOrCreatePrivateChat.mockReset();
  chatSvc.postMessage.mockReset();
  resetDb();
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  it('200: returns accessToken and refreshToken on valid credentials', async () => {
    const hash = await bcrypt.hash('pass1234', 10);
    userSvc.findUserByUsername.mockResolvedValue({
      id: 1, username: 'alice', password: hash, is_banned: false, role_id: 1,
    });
    roleSvc.findRoleById.mockResolvedValue({ id: 1, value: 'USER' });

    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'alice', password: 'pass1234' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user.username).toBe('alice');
  });

  it('400: unknown username', async () => {
    userSvc.findUserByUsername.mockResolvedValue(undefined);
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'nobody', password: 'x' });
    expect(res.status).toBe(400);
  });

  it('400: wrong password', async () => {
    const hash = await bcrypt.hash('correct', 10);
    userSvc.findUserByUsername.mockResolvedValue({
      id: 2, username: 'alice', password: hash, is_banned: false, role_id: 1,
    });
    roleSvc.findRoleById.mockResolvedValue({ id: 1, value: 'USER' });
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'alice', password: 'wrong' });
    expect(res.status).toBe(400);
  });

  it('403: banned user cannot log in', async () => {
    userSvc.findUserByUsername.mockResolvedValue({
      id: 3, username: 'banned', password: 'h', is_banned: true,
    });
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'banned', password: 'any' });
    expect(res.status).toBe(403);
  });

  it('400: missing password field', async () => {
    userSvc.findUserByUsername.mockResolvedValue(undefined);
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'alice' });
    expect(res.status).toBe(400);
  });
});

// ─── POST /auth/refresh ────────────────────────────────────────────────────────

describe('POST /auth/refresh', () => {
  it('200: issues new tokens with a valid refresh token', async () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: 1, role: 'USER' }, 'test-secret-key', { expiresIn: '30d' });
    userSvc.getUserById.mockResolvedValue({ id: 1, is_banned: false } as any);

    const res = await request(app).post('/auth/refresh').send({ refreshToken: token });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
  });

  it('401: missing refresh token', async () => {
    const res = await request(app).post('/auth/refresh').send({});
    expect(res.status).toBe(401);
  });

  it('403: expired refresh token', async () => {
    const jwt = require('jsonwebtoken');
    const expired = jwt.sign({ id: 1, role: 'USER' }, 'test-secret-key', { expiresIn: '-1s' });
    const res = await request(app).post('/auth/refresh').send({ refreshToken: expired });
    expect(res.status).toBe(403);
  });

  it('403: tampered signature', async () => {
    const jwt = require('jsonwebtoken');
    const bad = jwt.sign({ id: 1, role: 'USER' }, 'wrong-secret');
    const res = await request(app).post('/auth/refresh').send({ refreshToken: bad });
    expect(res.status).toBe(403);
  });
});

// ─── POST /auth/pre-registration ──────────────────────────────────────────────

describe('POST /auth/pre-registration', () => {
  it('400: username too short', async () => {
    const res = await request(app)
      .post('/auth/pre-registration')
      .field('username', 'a')
      .field('password', 'Password1')
      .field('email', 'test@example.com');
    expect(res.status).toBe(400);
  });

  it('400: password without digit', async () => {
    const res = await request(app)
      .post('/auth/pre-registration')
      .field('username', 'validUser')
      .field('password', 'NoDigitsHere')
      .field('email', 'test@example.com');
    expect(res.status).toBe(400);
  });

  it('400: password too short', async () => {
    const res = await request(app)
      .post('/auth/pre-registration')
      .field('username', 'validUser')
      .field('password', 'P1')
      .field('email', 'test@example.com');
    expect(res.status).toBe(400);
  });

  it('400: invalid email format', async () => {
    const res = await request(app)
      .post('/auth/pre-registration')
      .field('username', 'validUser')
      .field('password', 'Valid1Pass')
      .field('email', 'not-an-email');
    expect(res.status).toBe(400);
  });

  it('200: valid data queues registration code', async () => {
    userSvc.findUserByUsername.mockResolvedValue(undefined);
    dbReturns([]); // email not taken
    userSvc.getRegistrationCode.mockResolvedValue(undefined);
    userSvc.saveRegistrationCode.mockResolvedValue(undefined);
    emailSvc.sendVerificationEmail.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/auth/pre-registration')
      .field('username', 'validUser')
      .field('password', 'Valid1Pass')
      .field('email', 'valid@example.com');
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Код подтверждения');
  });

  it('400: duplicate username', async () => {
    userSvc.findUserByUsername.mockResolvedValue({ id: 1, username: 'existing' } as any);
    const res = await request(app)
      .post('/auth/pre-registration')
      .field('username', 'existing')
      .field('password', 'Valid1Pass')
      .field('email', 'new@example.com');
    expect(res.status).toBe(400);
  });

  it('400: duplicate email', async () => {
    userSvc.findUserByUsername.mockResolvedValue(undefined);
    dbReturns([{ id: 2 }]); // email already taken
    const res = await request(app)
      .post('/auth/pre-registration')
      .field('username', 'freshUser')
      .field('password', 'Valid1Pass')
      .field('email', 'taken@example.com');
    expect(res.status).toBe(400);
  });
});

// ─── POST /auth/confirm-registration ─────────────────────────────────────────

describe('POST /auth/confirm-registration', () => {
  it('200: creates user on valid code', async () => {
    userSvc.getRegistrationCode.mockResolvedValue({
      email: 'new@x.com', username: 'newbie', password: '$2a$10$hash', avatar_url: null, code: '555555',
    });
    roleSvc.findRoleByValue.mockResolvedValue({ id: 1, value: 'USER' });
    userSvc.createUser.mockResolvedValue({ id: 5, username: 'newbie' } as any);
    userSvc.deleteRegistrationCode.mockResolvedValue(undefined);
    userSvc.findUserByUsername.mockResolvedValue(undefined);
    chatSvc.findOrCreatePrivateChat.mockResolvedValue({ id: 1 } as any);
    chatSvc.postMessage.mockResolvedValue(undefined as any);
    dbReturns([]); // friends insert

    const res = await request(app)
      .post('/auth/confirm-registration')
      .send({ email: 'new@x.com', code: '555555' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
  });

  it('400: wrong confirmation code', async () => {
    userSvc.getRegistrationCode.mockResolvedValue({
      email: 'x@y.com', username: 'u', password: 'h', code: '111111',
    });
    const res = await request(app)
      .post('/auth/confirm-registration')
      .send({ email: 'x@y.com', code: '000000' });
    expect(res.status).toBe(400);
  });

  it('400: no pending registration', async () => {
    userSvc.getRegistrationCode.mockResolvedValue(undefined);
    const res = await request(app)
      .post('/auth/confirm-registration')
      .send({ email: 'ghost@y.com', code: '123456' });
    expect(res.status).toBe(400);
  });
});

// ─── POST /auth/forgot-password ───────────────────────────────────────────────

describe('POST /auth/forgot-password', () => {
  it('200: returns generic message even for unknown email', async () => {
    dbReturns([]);
    const res = await request(app).post('/auth/forgot-password').send({ email: 'ghost@x.com' });
    expect(res.status).toBe(200);
  });

  it('400: no email in body', async () => {
    const res = await request(app).post('/auth/forgot-password').send({});
    expect(res.status).toBe(400);
  });
});

// ─── GET /auth/users (admin-only) ─────────────────────────────────────────────

describe('GET /auth/users', () => {
  it('401: no Authorization header', async () => {
    const res = await request(app).get('/auth/users');
    expect(res.status).toBe(401);
  });

  it('403: USER role cannot access', async () => {
    const token = makeAccessToken(1, 'USER');
    dbReturns([{ is_banned: false }]); // authMiddleware
    dbReturns([{ role: 'USER' }]); // roleMiddleware DB check
    const res = await request(app)
      .get('/auth/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('200: ADMIN role returns user list', async () => {
    const token = makeAccessToken(1, 'ADMIN');
    dbReturns([{ is_banned: false }]); // authMiddleware
    dbReturns([{ role: 'ADMIN' }]); // roleMiddleware
    userSvc.getAllUsers.mockResolvedValue([{ id: 1, username: 'alice' }] as any);

    const res = await request(app)
      .get('/auth/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
