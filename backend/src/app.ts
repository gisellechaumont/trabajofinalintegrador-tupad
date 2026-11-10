import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { AppError } from './shared/errors.js';
import { requireAuth } from './middlewares/auth.js';
import { errorHandler, notFound } from './middlewares/errors.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { activitiesRouter } from './modules/activities/activities.routes.js';
import { operationalRouter } from './modules/operational.routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  app.set('trust proxy', env.TRUST_PROXY === 1 ? 1 : false);
  app.use(helmet());
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || origin === env.CORS_ORIGIN) callback(null, true);
      else callback(new AppError(403, 'CORS_ORIGIN_DENIED', 'Origen de la solicitud no permitido.'));
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  app.use(express.json({ limit: '16kb', strict: true }));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/v1', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use('/api/v1/auth', createAuthRouter());
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/activities', activitiesRouter);
  app.use('/api/v1', requireAuth, operationalRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
