import { z } from 'zod';
import { booleanQuery, paginationSchema } from '../../shared/validation.js';

const activityName = z.string().trim().min(1, 'El nombre es obligatorio.').max(100, 'Usá hasta 100 caracteres.');
export const createActivitySchema = z.object({ name: activityName, description: z.string().trim().max(1000).nullable().optional() }).strict();
export const patchActivitySchema = z.object({
  name: activityName.optional(), description: z.string().trim().max(1000).nullable().optional(), active: z.boolean().optional(),
}).strict().refine((data) => Object.keys(data).length > 0, 'Ingresá al menos un cambio.');
export const activitiesQuerySchema = paginationSchema.extend({ active: booleanQuery.optional(), search: z.string().trim().max(120).optional() }).strict();
export type ActivitiesQuery = z.infer<typeof activitiesQuerySchema>;
