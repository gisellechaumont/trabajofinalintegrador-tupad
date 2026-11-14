import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';

async function start() {
  await prisma.$connect();
  const server = createApp().listen(env.PORT, env.HOST, () => console.info(`GymFlow API disponible en http://${env.HOST}:${env.PORT}.`));
  const shutdown = () => server.close(() => { void prisma.$disconnect().then(() => process.exit(0)); });
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
start().catch(() => { console.error('STARTUP_FAILED: revisar configuración y disponibilidad de PostgreSQL.'); process.exit(1); });
