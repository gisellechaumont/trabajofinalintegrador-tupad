import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { parse } from 'dotenv';
import pg from 'pg';

let stage = 'CONFIG';
async function main() {
  const config = parse(readFileSync('.env.test'));
  const testUrl = process.env.TEST_DATABASE_URL || config.TEST_DATABASE_URL;
  if (!testUrl) throw new Error('Falta TEST_DATABASE_URL. Ejecutar npm run setup.');
  const target = new URL(testUrl);
  if (!['postgres:', 'postgresql:'].includes(target.protocol) || target.pathname !== '/gymflow_test') {
    throw new Error('Las pruebas solo pueden usar una base llamada gymflow_test.');
  }
  const administrative = new URL(testUrl); administrative.pathname = '/postgres'; administrative.searchParams.delete('schema');
  const client = new pg.Client({ connectionString: administrative.toString() });
  stage = 'DATABASE';
  try {
    await client.connect();
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', ['gymflow_test']);
    if (!exists.rowCount) await client.query('CREATE DATABASE gymflow_test');
  } finally { await client.end(); }
  const env = { ...process.env, ...config, DATABASE_URL: testUrl, TEST_DATABASE_URL: testUrl, NODE_ENV: 'test' };
  stage = 'MIGRATIONS';
  const require = createRequire(import.meta.url);
  const migrated = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { env, stdio: 'inherit' });
  if (migrated.status !== 0) throw new Error('No se pudieron preparar las migraciones de prueba.');
  const tests = spawnSync(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', 'tests/integration.test.ts'], { env, stdio: 'inherit' });
  process.exitCode = tests.status ?? 1;
}
main().catch((error: unknown) => {
  const rawCode = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const code = /^[A-Z0-9_]{1,40}$/.test(rawCode) ? rawCode : 'UNKNOWN';
  console.error(`TEST_SETUP_FAILED (${stage}/${code}): revisar backend/.env.test y disponibilidad/permisos de PostgreSQL. No se imprimen URLs ni claves.`);
  process.exitCode = 1;
});
