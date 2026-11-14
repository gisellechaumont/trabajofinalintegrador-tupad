import { z } from 'zod';
import { AppError } from './errors.js';
z.config(z.locales.es());

export function parse<T extends z.ZodTypeAny>(schema: T, input: unknown, status = 422): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields = Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.') || 'form', issue.message]));
    throw new AppError(status, status === 400 ? 'INVALID_REQUEST' : 'VALIDATION_ERROR', 'Revisá los datos ingresados.', fields);
  }
  return result.data;
}

export const idSchema = z.string().regex(/^[1-9]\d*$/, 'El identificador debe ser un entero positivo.')
  .transform(Number).pipe(z.number().int().positive().max(2147483647));
export const idParams = z.object({ id: idSchema }).strict();
export const booleanQuery = z.enum(['true', 'false']).transform((value) => value === 'true');
export const paginationSchema = z.object({
  page: idSchema.default(1),
  pageSize: idSchema.pipe(z.number().max(100, 'El máximo es 100.')).default(20),
});
export const nameSchema = z.string().trim().min(1, 'El nombre es obligatorio.').max(120, 'El nombre admite hasta 120 caracteres.');
export const emailSchema = z.string().trim().toLowerCase().email('Ingresá un correo válido.').max(255);
export const passwordSchema = z.string().min(12, 'Usá al menos 12 caracteres.').max(128, 'Usá hasta 128 caracteres.');
export const emptyQuery = z.object({}).strict();
