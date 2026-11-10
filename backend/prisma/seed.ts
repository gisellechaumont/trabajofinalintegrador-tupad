import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { passwordSchema } from '../src/shared/validation.js';
import { hashPassword } from '../src/shared/password.js';

export async function seedDatabase(client: PrismaClient, password: string) {
  const passwordHash = await hashPassword(passwordSchema.parse(password));
  const users = [
    { name: 'Admin GymFlow', email: 'admin@gymflow.test', role: 'ADMIN' },
    { name: 'Ana Professor', email: 'ana.professor@gymflow.test', role: 'PROFESSOR' },
    { name: 'Bruno Professor', email: 'bruno.professor@gymflow.test', role: 'PROFESSOR' },
    { name: 'Juan Member', email: 'juan.member@gymflow.test', role: 'MEMBER' },
    { name: 'Laura Member', email: 'laura.member@gymflow.test', role: 'MEMBER' },
  ];
  for (const user of users) {
    // No reinicia contraseñas, estados, nombres ni avances de una demo existente.
    await client.user.upsert({ where: { email: user.email }, update: {}, create: { ...user, passwordHash } });
  }
  for (const activity of [
    { name: 'Yoga', description: 'Clases de yoga.' },
    { name: 'Pilates', description: 'Clases de pilates.' },
    { name: 'Entrenamiento funcional', description: 'Entrenamiento general en grupo.' },
  ]) {
    const existing = await client.activity.findFirst({ where: { name: { equals: activity.name, mode: 'insensitive' } } });
    if (!existing) await client.activity.create({ data: activity });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.env.NODE_ENV === 'production') throw new Error('Este seed es de demostración local, no se ejecuta en producción.');
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || !['postgres:', 'postgresql:'].includes(new URL(connectionString).protocol)) throw new Error('Falta una DATABASE_URL válida para el seed.');
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 }), log: [] });
  seedDatabase(client, process.env.SEED_PASSWORD ?? '')
    .then(() => console.info('Seed listo: usuarios y actividades ficticios. La clave está en SEED_PASSWORD, no se imprime.'))
    .catch(() => { console.error('SEED_FAILED: revisar migraciones y SEED_PASSWORD (12 a 128 caracteres).'); process.exitCode = 1; })
    .finally(() => client.$disconnect());
}
