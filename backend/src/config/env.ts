import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.enum(['127.0.0.1', '0.0.0.0', '::1']).default('127.0.0.1'),
  DATABASE_URL: z.string().url().refine((value) => ['postgres:', 'postgresql:'].includes(new URL(value).protocol)),
  JWT_SECRET: z.string().refine((value) => Buffer.byteLength(value) >= 32, 'Usar al menos 32 bytes aleatorios.'),
  JWT_ISSUER: z.string().min(1).default('gymflow'),
  JWT_AUDIENCE: z.string().min(1).default('gymflow-web'),
  CORS_ORIGIN: z.string().url().refine((value) => new URL(value).origin === value, 'Indicar solo el origen, sin ruta ni barra final.').default('http://localhost:5173'),
  TRUST_PROXY: z.coerce.number().int().min(0).max(1).default(0),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Solo se informan nombres de variables, nunca sus valores o credenciales.
  const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))];
  throw new Error(`Configuración incompleta o inválida: ${fields.join(', ')}. Revisar backend/.env.`);
}
export const env = parsed.data;
