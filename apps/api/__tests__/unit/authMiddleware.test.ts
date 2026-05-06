/**
 * Unit tests for authMiddleware.
 * Mocks the DB and JWT config.
 */

import '../helpers/jwt.helpers'; // mocks config.secret
import { mockQuery, resetDb, dbReturns } from '../helpers/db.mock';
import { makeAccessToken, makeExpiredToken, makeBadSignatureToken } from '../helpers/jwt.helpers';
import authMiddleware from '../../middleware/authMiddleware';

function mockReqRes(authHeader?: string) {
  const req: any = {
    method: 'GET',
    headers: authHeader ? { authorization: authHeader } : {},
  };
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const next = jest.fn();
  return { req, res, next };
}

beforeEach(() => resetDb());

describe('authMiddleware', () => {
  it('calls next() for OPTIONS preflight without checking auth', async () => {
    const { req, res, next } = mockReqRes();
    req.method = 'OPTIONS';
    await authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 when no Authorization header', async () => {
    const { req, res, next } = mockReqRes();
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header has no token', async () => {
    const { req, res, next } = mockReqRes('Bearer ');
    // empty token after split
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when token is expired', async () => {
    const { req, res, next } = mockReqRes(`Bearer ${makeExpiredToken(1)}`);
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    const jsonArg = res.json.mock.calls[0][0];
    expect(jsonArg.message).toContain('истёк');
  });

  it('returns 401 when token has wrong signature', async () => {
    const { req, res, next } = mockReqRes(`Bearer ${makeBadSignatureToken()}`);
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when user not found in DB', async () => {
    const token = makeAccessToken(999);
    dbReturns([]); // user not found
    const { req, res, next } = mockReqRes(`Bearer ${token}`);
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 403 when user is banned', async () => {
    const token = makeAccessToken(5);
    dbReturns([{ is_banned: true }]);
    const { req, res, next } = mockReqRes(`Bearer ${token}`);
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    const jsonArg = res.json.mock.calls[0][0];
    expect(jsonArg.message).toContain('заблокирован');
  });

  it('attaches req.user and calls next() for a valid token from an active user', async () => {
    const token = makeAccessToken(7, 'ADMIN');
    dbReturns([{ is_banned: false }]);
    const { req, res, next } = mockReqRes(`Bearer ${token}`);
    await authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: 7, role: 'ADMIN' });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 503 when DB throws during ban check', async () => {
    const token = makeAccessToken(8);
    mockQuery.mockRejectedValueOnce(new Error('connection refused'));
    const { req, res, next } = mockReqRes(`Bearer ${token}`);
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('returns 401 when token is missing Bearer prefix', async () => {
    const { req, res, next } = mockReqRes('INVALID_TOKEN_FORMAT');
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
