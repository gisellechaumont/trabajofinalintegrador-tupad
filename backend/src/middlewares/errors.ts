import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../shared/errors.js';

export const notFound: RequestHandler = (_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'No se encontró el recurso solicitado.'));

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (res.headersSent) return;
  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message, fields: error.fields } });
    return;
  }
  if (error instanceof Error && 'type' in error) {
    if (error.type === 'entity.parse.failed') {
      res.status(400).json({ error: { code: 'INVALID_JSON', message: 'El cuerpo JSON no es válido.', fields: {} } }); return;
    }
    if (error.type === 'entity.too.large') {
      res.status(413).json({ error: { code: 'REQUEST_TOO_LARGE', message: 'La solicitud supera el tamaño permitido.', fields: {} } }); return;
    }
  }
  // No se registran mensajes crudos del driver, URLs, contraseñas ni tokens.
  console.error('REQUEST_FAILED');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un problema inesperado. Intentá nuevamente.', fields: {} } });
};
