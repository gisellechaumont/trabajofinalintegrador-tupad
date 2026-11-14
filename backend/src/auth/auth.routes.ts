import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireAuth, identity } from '../../middlewares/auth.js';
import { parse, emptyQuery } from '../../shared/validation.js';
import { AppError } from '../../shared/errors.js';
import { loginSchema, profileSchema, passwordChangeSchema } from './auth.validation.js';
import { login, changePassword } from './auth.service.js';
import { profileById, updateProfile } from './auth.repository.js';

export function createAuthRouter() {
  const router = Router();
  router.post('/login', rateLimit({
    windowMs: 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: { code: 'TOO_MANY_ATTEMPTS', message: 'Hubo varios intentos. Esperá un minuto antes de volver a intentar.', fields: {} } }),
  }), async (req, res) => {
    parse(emptyQuery, req.query, 400);
    const input = parse(loginSchema, req.body);
    res.json({ data: await login(input.email, input.password) });
  });
  router.use(requireAuth);
  router.get('/me', async (req, res) => {
    parse(emptyQuery, req.query, 400);
    const user = await profileById(identity(req).id);
    if (!user) throw new AppError(401, 'INVALID_SESSION', 'Tu sesión no está disponible.');
    res.json({ data: user });
  });
  router.patch('/profile', async (req, res) => {
    parse(emptyQuery, req.query, 400);
    res.json({ data: await updateProfile(identity(req).id, parse(profileSchema, req.body)) });
  });
  router.put('/password', async (req, res) => {
    parse(emptyQuery, req.query, 400);
    const input = parse(passwordChangeSchema, req.body);
    await changePassword(identity(req).id, input.currentPassword, input.newPassword);
    res.status(204).end();
  });
  return router;
}
