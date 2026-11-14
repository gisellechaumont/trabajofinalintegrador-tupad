import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const random = () => randomBytes(32).toString('base64url');
function create(relative, content) {
  const target = path.join(root, relative);
  if (!existsSync(target)) { writeFileSync(target, content, { flag: 'wx', mode: 0o600 }); console.info(`Creado ${relative}`); }
  else console.info(`Conservado ${relative} (no se sobrescribió).`);
}
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 12)) throw new Error('Se necesita Node.js 22.12 o posterior.');
create('.env', `POSTGRES_PASSWORD=${random()}\n`);
const match = readFileSync(path.join(root, '.env'), 'utf8').match(/^POSTGRES_PASSWORD=(\S+)$/m);
if (!match) throw new Error('Falta POSTGRES_PASSWORD en .env. No se modificó la configuración existente.');
const connection = (database) => `postgresql://gymflow:${encodeURIComponent(match[1])}@localhost:55432/${database}?schema=public`;
create('backend/.env', `NODE_ENV=development\nPORT=3000\nDATABASE_URL=${connection('gymflow')}\nJWT_SECRET=${random()}\nJWT_ISSUER=gymflow\nJWT_AUDIENCE=gymflow-web\nCORS_ORIGIN=http://localhost:5173\nTRUST_PROXY=0\nSEED_PASSWORD=${random()}\n`);
create('backend/.env.test', `NODE_ENV=test\nTEST_DATABASE_URL=${connection('gymflow_test')}\nJWT_SECRET=${random()}\nJWT_ISSUER=gymflow\nJWT_AUDIENCE=gymflow-web\nCORS_ORIGIN=http://localhost:5173\nTRUST_PROXY=0\n`);
create('frontend/.env', 'VITE_API_URL=http://localhost:3000/api/v1\n');
console.info('Configuración local lista. Las claves aleatorias están en los .env ignorados por Git, no se imprimen.');
console.info('Siguiente: docker compose up -d db; npm run db:migrate; npm run db:seed; npm run dev.');
