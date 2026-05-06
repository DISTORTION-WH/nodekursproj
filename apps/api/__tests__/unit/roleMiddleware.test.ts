/**
 * Unit tests for roleMiddleware.
 * Checks that DB-fresh role lookups replace token claims correctly.
 */

import '../helpers/jwt.helpers';
import { mockQuery, resetDb, dbReturns } from '../helpers/db.mock';
import { makeAccessToken, makeExpiredToken } from '../helpers/jwt.helpers';
import roleMiddleware from '../../middleware/roleMiddleware';

function mkRQ(authHeader?: string) {
  const req: any = { method: 'GET', headers: authHeader ? { authorization: authHeader } : {} };
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  return { req, res, next };
}

beforeEach(() => resetDb());

describe('roleMiddleware', () => {
  it('passes OPTIONS without any check', async () => {
    const mw = roleMiddleware(['ADMIN']);
    const { req, res, next } = mkRQ();
    req.method = 'OPTIONS';
    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 when no auth header', async () => {
    const mw = roleMiddleware('ADMIN');
    const { req, res, next } = mkRQ();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows access when DB role matches required role (string)', async () => {
    const mw = roleMiddleware('ADMIN');
    const token = makeAccessToken(1, 'USER'); // token says USER
    dbReturns([{ role: 'ADMIN' }]); // but DB says ADMIN
    const { req, res, next } = mkRQ(`Bearer ${token}`);
    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows access when DB role is in allowed array', async () => {
    const mw = roleMiddleware(['ADMIN', 'MODERATOR']);
    const token = makeAccessToken(2, 'USER');
    dbReturns([{ role: 'MODERATOR' }]);
    const { req, res, next } = mkRQ(`Bearer ${token}`);
    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('denies access when DB role is not in allowed list', async () => {
    const mw = roleMiddleware(['ADMIN']);
    const token = makeAccessToken(3, 'ADMIN'); // token claims ADMIN
    dbReturns([{ role: 'USER' }]); // DB says USER (role was downgraded)
    const { req, res, next } = mkRQ(`Bearer ${token}`);
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when user not found in DB', async () => {
    const mw = roleMiddleware('USER');
    const token = makeAccessToken(99);
    dbReturns([]); // user not found
    const { req, res, next } = mkRQ(`Bearer ${token}`);
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 401 when token is expired', async () => {
    const mw = roleMiddleware('ADMIN');
    const token = makeExpiredToken(1);
    const { req, res, next } = mkRQ(`Bearer ${token}`);
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('treats null DB role as USER', async () => {
    const mw = roleMiddleware('USER');
    const token = makeAccessToken(5, 'USER');
    dbReturns([{ role: null }]); // role column is null
    const { req, res, next } = mkRQ(`Bearer ${token}`);
    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('denies USER when ADMIN is required, regardless of token claim', async () => {
    const mw = roleMiddleware('ADMIN');
    const token = makeAccessToken(6, 'ADMIN');
    dbReturns([{ role: 'USER' }]);
    const { req, res, next } = mkRQ(`Bearer ${token}`);
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
