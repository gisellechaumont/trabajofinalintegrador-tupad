import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { env } from '../src/config/env.js';
import { createToken } from '../src/shared/token.js';
import { hashPassword } from '../src/shared/password.js';

if (env.NODE_ENV !== 'test' || new URL(env.DATABASE_URL).pathname !== '/gymflow_test') {
  throw new Error('Se requiere la base desechable gymflow_test.');
}

const app = createApp();
const roles = ['ADMIN', 'MEMBER', 'PROFESSOR'] as const;
type TestRole = 'admin' | 'member' | 'professor';
let ids: Record<TestRole, number>;
let tokens: Record<TestRole, string>;
const auth = (role: TestRole = 'admin') => ({ Authorization: `Bearer ${tokens[role]}` });

before(async () => { await prisma.$connect(); });

beforeEach(async () => {
  await prisma.$transaction([
    prisma.enrollment.deleteMany(),
    prisma.memberPackage.deleteMany(),
    prisma.class.deleteMany(),
    prisma.packageType.deleteMany(),
    prisma.activity.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  const passwordHash = await hashPassword(randomBytes(24).toString('hex'));
  const users = await Promise.all(roles.map((role) => prisma.user.create({
    data: { name: `Usuario ${role}`, email: `${role.toLowerCase()}@package-types.test`, role, passwordHash },
  })));
  ids = { admin: users[0].id, member: users[1].id, professor: users[2].id };
  tokens = {
    admin: await createToken(ids.admin),
    member: await createToken(ids.member),
    professor: await createToken(ids.professor),
  };
});

after(async () => { await prisma.$disconnect(); });

test('HU-18: ADMIN crea un tipo recortado y activo; otros roles no acceden', async () => {
  const body = { name: '  Mensual  ', classCredits: 12, durationDays: 30 };
  for (const role of ['member', 'professor'] as const) {
    await request(app).post('/api/v1/package-types').set(auth(role)).send(body).expect(403);
  }

  const created = await request(app).post('/api/v1/package-types').set(auth()).send(body).expect(201);
  assert.deepEqual(created.body.data, {
    id: created.body.data.id,
    name: 'Mensual',
    classCredits: 12,
    durationDays: 30,
    active: true,
  });
});

test('HU-18/HU-20: valida payloads estrictos y PATCH exige al menos un cambio', async () => {
  const valid = { name: 'Mensual', classCredits: 12, durationDays: 30 };
  for (const invalid of [
    { ...valid, name: '   ' },
    { ...valid, name: 'x'.repeat(101) },
    { ...valid, classCredits: 0 },
    { ...valid, classCredits: 1.5 },
    { ...valid, durationDays: 0 },
    { ...valid, active: false },
    { ...valid, extra: true },
  ]) {
    const response = await request(app).post('/api/v1/package-types').set(auth()).send(invalid).expect(422);
    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  }
  await request(app).patch('/api/v1/package-types/1').set(auth()).send({}).expect(422);
  await request(app).patch('/api/v1/package-types/1').set(auth()).send({ active: 'false' }).expect(422);
});

test('HU-18/HU-20: unicidad normalizada produce el código funcional acordado', async () => {
  const created = await request(app).post('/api/v1/package-types').set(auth()).send({
    name: 'Mensual', classCredits: 12, durationDays: 30,
  }).expect(201);

  const duplicate = await request(app).post('/api/v1/package-types').set(auth()).send({
    name: '  MENSUAL  ', classCredits: 8, durationDays: 15,
  }).expect(409);
  assert.equal(duplicate.body.error.code, 'PACKAGE_TYPE_NAME_CONFLICT');

  assert.equal(await prisma.packageType.count(), 1);
  const second = await request(app).post('/api/v1/package-types').set(auth()).send({
    name: 'Complementario', classCredits: 8, durationDays: 15,
  }).expect(201);

  const idempotent = await request(app).patch(`/api/v1/package-types/${created.body.data.id}`).set(auth()).send({ name: '  MENSUAL  ' }).expect(200);
  assert.equal(idempotent.body.data.name, 'MENSUAL');

  const beforeConflict = await prisma.packageType.findMany({ orderBy: { id: 'asc' } });
  assert.equal(beforeConflict.length, 2);
  const renamed = await request(app).patch(`/api/v1/package-types/${created.body.data.id}`).set(auth()).send({ name: '  complementario  ' }).expect(409);
  assert.equal(renamed.body.error.code, 'PACKAGE_TYPE_NAME_CONFLICT');

  const afterConflict = await prisma.packageType.findMany({ orderBy: { id: 'asc' } });
  assert.equal(afterConflict.length, 2);
  assert.deepEqual(afterConflict, beforeConflict);
  assert.equal(afterConflict[0].id, created.body.data.id);
  assert.equal(afterConflict[0].name, 'MENSUAL');
  assert.equal(afterConflict[1].id, second.body.data.id);
  assert.equal(afterConflict[1].name, 'Complementario');
});

test('HU-18: altas concurrentes equivalentes dejan un único tipo y un conflicto identificado', async () => {
  const body = { name: '  Pack Básico ', classCredits: 8, durationDays: 20 };
  const responses = await Promise.all([
    request(app).post('/api/v1/package-types').set(auth()).send(body),
    request(app).post('/api/v1/package-types').set(auth()).send({ ...body, name: 'pack básico' }),
  ]);

  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
  const conflict = responses.find((response) => response.status === 409);
  assert.equal(conflict?.body.error.code, 'PACKAGE_TYPE_NAME_CONFLICT');
  assert.equal(await prisma.packageType.count({ where: { name: { contains: 'Pack Básico', mode: 'insensitive' } } }), 1);
});

test('HU-19: ADMIN consulta por nombre y estado con paginación estable por id', async () => {
  const first = await prisma.packageType.create({ data: { name: 'Mensual A', classCredits: 8, durationDays: 30 } });
  await prisma.packageType.create({ data: { name: 'mensual B', classCredits: 10, durationDays: 30 } });
  await prisma.packageType.create({ data: { name: 'Anual', classCredits: 100, durationDays: 365, active: false } });

  for (const role of ['member', 'professor'] as const) {
    await request(app).get('/api/v1/package-types').set(auth(role)).expect(403);
  }
  const filtered = await request(app).get('/api/v1/package-types?search=MENSUAL&active=true&page=1&pageSize=1').set(auth()).expect(200);
  assert.equal(filtered.body.meta.total, 2);
  assert.equal(filtered.body.meta.page, 1);
  assert.equal(filtered.body.meta.pageSize, 1);
  assert.equal(filtered.body.data[0].id, first.id);

  const invalidQuery = await request(app).get('/api/v1/package-types?active=TRUE').set(auth()).expect(400);
  assert.equal(invalidQuery.body.error.code, 'INVALID_REQUEST');
  await request(app).get('/api/v1/package-types?page=1&pageSize=101').set(auth()).expect(400);
});

test('HU-19: el detalle distingue tipo inexistente y mantiene permisos ADMIN', async () => {
  const type = await prisma.packageType.create({ data: { name: 'Mensual', classCredits: 12, durationDays: 30 } });
  const detail = await request(app).get(`/api/v1/package-types/${type.id}`).set(auth()).expect(200);
  assert.equal(detail.body.data.id, type.id);

  for (const role of ['member', 'professor'] as const) {
    await request(app).get(`/api/v1/package-types/${type.id}`).set(auth(role)).expect(403);
  }
  const missing = await request(app).get('/api/v1/package-types/2147483647').set(auth()).expect(404);
  assert.equal(missing.body.error.code, 'PACKAGE_TYPE_NOT_FOUND');
});

test('HU-20: PATCH modifica, desactiva y reactiva sin borrar el tipo', async () => {
  const type = await prisma.packageType.create({ data: { name: 'Mensual', classCredits: 12, durationDays: 30 } });
  const updated = await request(app).patch(`/api/v1/package-types/${type.id}`).set(auth()).send({
    name: 'Mensual Plus', classCredits: 16, durationDays: 45,
  }).expect(200);
  assert.deepEqual(updated.body.data, { id: type.id, name: 'Mensual Plus', classCredits: 16, durationDays: 45, active: true });

  const deactivated = await request(app).patch(`/api/v1/package-types/${type.id}`).set(auth()).send({ active: false }).expect(200);
  assert.equal(deactivated.body.data.active, false);
  const reactivated = await request(app).patch(`/api/v1/package-types/${type.id}`).set(auth()).send({ active: true }).expect(200);
  assert.equal(reactivated.body.data.active, true);

  await request(app).delete(`/api/v1/package-types/${type.id}`).set(auth()).expect(404);
  assert.equal(await prisma.packageType.count({ where: { id: type.id } }), 1);
  for (const role of ['member', 'professor'] as const) {
    await request(app).patch(`/api/v1/package-types/${type.id}`).set(auth(role)).send({ active: false }).expect(403);
  }
});

test('HU-20: modificar el tipo no recalcula snapshots de asignaciones existentes', async () => {
  const type = await prisma.packageType.create({ data: { name: 'Mensual', classCredits: 12, durationDays: 30 } });
  const startsOn = new Date('2030-02-04T00:00:00.000Z');
  const expiresOn = new Date('2030-03-05T00:00:00.000Z');
  const assignment = await prisma.memberPackage.create({ data: {
    memberId: ids.member,
    packageTypeId: type.id,
    startsOn,
    expiresOn,
    initialCredits: 12,
    remainingCredits: 7,
  } });

  await request(app).patch(`/api/v1/package-types/${type.id}`).set(auth()).send({
    classCredits: 20, durationDays: 60, active: false,
  }).expect(200);

  const unchanged = await prisma.memberPackage.findUniqueOrThrow({ where: { id: assignment.id } });
  assert.equal(unchanged.initialCredits, 12);
  assert.equal(unchanged.remainingCredits, 7);
  assert.equal(unchanged.startsOn.getTime(), startsOn.getTime());
  assert.equal(unchanged.expiresOn.getTime(), expiresOn.getTime());
});
