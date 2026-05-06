/**
 * Global Jest setup — mocks modules that crash on import without env vars.
 * Also mocks express-rate-limit so tests never hit 429.
 */

// Bypass rate limiting in all tests
jest.mock('express-rate-limit', () => {
  return () => (_req: any, _res: any, next: any) => next();
});

// Minio requires valid endpoint on construction — mock the whole module
jest.mock('minio', () => ({
  Client: jest.fn().mockImplementation(() => ({
    putObject: jest.fn().mockResolvedValue(undefined),
    bucketExists: jest.fn().mockResolvedValue(true),
  })),
}));

// Mediasoup requires native binaries — stub it out
jest.mock('mediasoup', () => ({
  createWorker: jest.fn().mockResolvedValue({
    createRouter: jest.fn().mockResolvedValue({
      createWebRtcTransport: jest.fn(),
      rtpCapabilities: {},
    }),
    close: jest.fn(),
  }),
}));

// Deepgram requires API key
jest.mock('@deepgram/sdk', () => ({
  createClient: jest.fn(() => ({
    listen: { live: jest.fn() },
  })),
}));

// Suppress console noise during tests
global.console.warn = jest.fn();
global.console.error = jest.fn();
