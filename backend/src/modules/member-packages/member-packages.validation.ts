import { z } from 'zod';
import { booleanQuery, idSchema, paginationSchema } from '../../shared/validation.js';
import { isValidCivilDate } from './member-packages.dates.js';

export const packageStatusSchema = z.enum(['NOT_STARTED', 'ACTIVE', 'EXHAUSTED', 'EXPIRED']);

const civilDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usá el formato AAAA-MM-DD.')
  .refine(isValidCivilDate, 'Ingresá una fecha civil válida.');

export const createMemberPackageSchema = z.object({
  memberId: z.number().int().positive().max(2147483647),
  packageTypeId: z.number().int().positive().max(2147483647),
  startsOn: civilDateSchema,
}).strict();

export const memberPackagesQuerySchema = paginationSchema.extend({
  memberId: idSchema.optional(),
  status: packageStatusSchema.optional(),
  expiringSoon: booleanQuery.optional(),
}).strict();

export type PackageStatus = z.infer<typeof packageStatusSchema>;
export type CreateMemberPackageInput = z.infer<typeof createMemberPackageSchema>;
export type MemberPackagesQuery = z.infer<typeof memberPackagesQuerySchema>;
