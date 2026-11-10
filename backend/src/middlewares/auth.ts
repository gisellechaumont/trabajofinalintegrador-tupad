import type { RequestHandler, Request } from 'express';
import { prisma } from '../config/prisma.js';
import { AppError } from '../shared/errors.js';
import { verifyToken } from '../shared/token.js';
import { roleSchema, type Role } from '../shared/types.js';

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.get('authorization');
  if (!header || header.length > 2048 || !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(header)) {
    throw new AppError(401, 'INVALID_SESSION', 'Iniciá sesión para continuar.');
  }
  const id = await verifyToken(header.slice(7));
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, active: true } });
  if (!user?.active) throw new AppError(401, 'INVALID_SESSION', 'Tu sesión no está disponible. Volvé a iniciar sesión.');
  req.user = { id: user.id, role: roleSchema.parse(user.role) };
  next();
};

export function allowRoles(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    const user = identity(req);
    if (!roles.includes(user.role)) throw new AppError(403, 'FORBIDDEN', 'No tenés permisos para realizar esta acción.');
    next();
  };
}

export function identity(req: Request) {
  if (!req.user) throw new AppError(401, 'INVALID_SESSION', 'Iniciá sesión para continuar.');
  return req.user;
}
