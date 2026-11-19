import { z } from 'zod';
import { booleanQuery, paginationSchema } from '../../shared/validation.js';

const packageTypeName = z.string()
  .trim()
  .min(1, 'El nombre es obligatorio.')
  .max(100, 'Usá hasta 100 caracteres.');

const positiveInteger = z.number().int().positive();

export const createPackageTypeSchema = z.object({
  name: packageTypeName,
  classCredits: positiveInteger,
  durationDays: positiveInteger,
}).strict();

export const patchPackageTypeSchema = z.object({
  name: packageTypeName.optional(),
  classCredits: positiveInteger.optional(),
  durationDays: positiveInteger.optional(),
  active: z.boolean().optional(),
}).strict().refine((data) => Object.keys(data).length > 0, 'Ingresá al menos un cambio.');

export const packageTypesQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  active: booleanQuery.optional(),
}).strict();

export type CreatePackageTypeInput = z.infer<typeof createPackageTypeSchema>;
export type PatchPackageTypeInput = z.infer<typeof patchPackageTypeSchema>;
export type PackageTypesQuery = z.infer<typeof packageTypesQuerySchema>;
