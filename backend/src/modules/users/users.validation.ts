import { z } from 'zod';
import { nameSchema, emailSchema, passwordSchema, paginationSchema, booleanQuery } from '../../shared/validation.js';

export const manageableRole = z.enum(['MEMBER', 'PROFESSOR']);
export const createUserSchema = z.object({ name: nameSchema, email: emailSchema, password: passwordSchema, role: manageableRole }).strict();
export const patchUserSchema = z.object({ name: nameSchema.optional(), email: emailSchema.optional(), active: z.boolean().optional() })
  .strict().refine((data) => Object.keys(data).length > 0, 'Ingresá al menos un cambio.');
export const usersQuerySchema = paginationSchema.extend({
  role: manageableRole.optional(), active: booleanQuery.optional(), search: z.string().trim().max(120).optional(),
}).strict();
export type UsersQuery = z.infer<typeof usersQuerySchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type PatchUserInput = z.infer<typeof patchUserSchema>;
