/**
 * Minimal Express app for integration tests.
 * Imports routers lazily so each call to buildApp() gets fresh rate-limiter state.
 * Call buildApp() inside beforeAll (not at module top-level) to avoid rate-limiter bleed.
 */

import express, { Request, Response, NextFunction } from 'express';

interface AppError extends Error {
  status?: number;
  errors?: unknown[];
}

export function buildApp() {
  // Dynamic require so rate limiters are re-instantiated on each call
  const authRouter = require('../../Routes/authRouter').default;
  const chatRouter = require('../../Routes/chatRouter').default;
  const adminRouter = require('../../Routes/adminRouter').default;
  const moderatorRouter = require('../../Routes/moderatorRouter').default;
  const usersRouter = require('../../Routes/usersRouter').default;
  const friendsRouter = require('../../Routes/friendsRouter').default;

  const app = express();
  app.use(express.json());

  app.use('/auth', authRouter);
  app.use('/chats', chatRouter);
  app.use('/admin', adminRouter);
  app.use('/moderator', moderatorRouter);
  app.use('/users', usersRouter);
  app.use('/friends', friendsRouter);

  // Socket.io stub (chatController calls req.app.get('io'))
  app.set('io', {
    to: () => ({ emit: jest.fn(), to: () => ({ emit: jest.fn() }) }),
    emit: jest.fn(),
    in: () => ({ emit: jest.fn(), disconnectSockets: jest.fn() }),
  });

  // Central error handler
  app.use((err: AppError, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || 500;
    res.status(status).json({ message: err.message, errors: err.errors });
  });

  return app;
}
