import { Router } from 'express';

/**
 * Punto de entrada de Emilia: clases, paquetes, inscripciones, asistencia y panel.
 * Se monta UNA vez en /api/v1, después de requireAuth.
 * Agregar aquí routers de sus módulos; cada operación aplica allowRoles y propiedad.
 * Ejemplo de montaje futuro: operationalRouter.use('/classes', classesRouter).
 * No se crean endpoints ficticios ni se simulan saldos/resultados.
 */
export const operationalRouter = Router();
