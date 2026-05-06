import jwt from 'jsonwebtoken';

const TEST_SECRET = 'test-secret-key';

// Override config secret for tests
jest.mock('../../config', () => ({ secret: 'test-secret-key' }));

export function makeAccessToken(id: number, role = 'USER'): string {
  return jwt.sign({ id, role }, TEST_SECRET, { expiresIn: '15m' });
}

export function makeRefreshToken(id: number, role = 'USER'): string {
  return jwt.sign({ id, role }, TEST_SECRET, { expiresIn: '30d' });
}

export function makeExpiredToken(id: number, role = 'USER'): string {
  return jwt.sign({ id, role }, TEST_SECRET, { expiresIn: '-1s' });
}

export function makeBadSignatureToken(): string {
  return jwt.sign({ id: 1, role: 'USER' }, 'wrong-secret');
}
