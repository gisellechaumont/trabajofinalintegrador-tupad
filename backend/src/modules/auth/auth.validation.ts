import { z } from 'zod';
import { nameSchema, emailSchema, passwordSchema } from '../../shared/validation.js';

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Ingresá la contraseña.').max(128) }).strict();
export const profileSchema = z.object({ name: nameSchema.optional(), email: emailSchema.optional() })
  .strict().refine((data) => Object.keys(data).length > 0, 'Ingresá al menos un cambio.');
export const passwordChangeSchema = z.object({ currentPassword: z.string().min(1, 'Ingresá la contraseña actual.').max(128), newPassword: passwordSchema }).strict();
