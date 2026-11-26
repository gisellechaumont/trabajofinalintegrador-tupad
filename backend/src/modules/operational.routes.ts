import { Router } from 'express';
import {
  classesRouter,
} from './classes/classes.routes.js';
import { packageTypesRouter } from './package-types/package-types.routes.js';
import { memberPackagesRouter } from './member-packages/member-packages.routes.js';

/**
 * Punto de entrada de Emilia: clases, paquetes,
 * inscripciones, asistencia y panel.
 *
 * Se monta una vez en /api/v1, después de requireAuth.
 * Cada operación aplica allowRoles y propiedad.
 */
export const operationalRouter = Router();

operationalRouter.use(
  '/classes',
  classesRouter,
);

operationalRouter.use(
  '/package-types',
  packageTypesRouter,
);

operationalRouter.use(
  '/member-packages',
  memberPackagesRouter,
);
