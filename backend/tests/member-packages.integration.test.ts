import { after, afterEach, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { env } from '../src/config/env.js';
import { createToken } from '../src/shared/token.js';
import { hashPassword } from '../src/shared/password.js';
import { addCalendarDays, toDatabaseDate } from '../src/modules/member-packages/member-packages.dates.js';

if (env.NODE_ENV !== 'test' || new URL(env.DATABASE_URL).pathname !== '/gymflow_test') {
  throw new Error('Se requiere la base desechable gymflow_test.');
}

const app = createApp();
const TODAY = '2030-06-15';
type TestRole = 'admin' | 'member' | 'otherMember' | 'professor';
let ids: Record<TestRole, number>;
let tokens: Record<TestRole, string>;
const auth = (role: TestRole = 'admin') => ({ Authorization: `Bearer ${tokens[role]}` });

before(async () => { await prisma.$connect(); });

beforeEach(async (context) => {
  if (!('mock' in context)) {
    throw new Error('Se esperaba el contexto de una prueba para fijar el reloj.');
  }

  context.mock.timers.enable({ apis: ['Date'], now: new Date('2030-06-15T15:00:00.000Z') });
  await prisma.$transaction([
    prisma.enrollment.deleteMany(),
    prisma.memberPackage.deleteMany(),
    prisma.class.deleteMany(),
    prisma.packageType.deleteMany(),
    prisma.activity.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const passwordHash = await hashPassword(randomBytes(24).toString('hex'));
  const [admin, member, otherMember, professor] = await Promise.all([
    prisma.user.create({ data: { name: 'Admin Paquetes', email: 'admin@member-packages.test', role: 'ADMIN', passwordHash } }),
    prisma.user.create({ data: { name: 'Socio Paquetes', email: 'member@member-packages.test', role: 'MEMBER', passwordHash } }),
    prisma.user.create({ data: { name: 'Otro Socio', email: 'other-member@member-packages.test', role: 'MEMBER', passwordHash } }),
    prisma.user.create({ data: { name: 'Profesor Paquetes', email: 'professor@member-packages.test', role: 'PROFESSOR', passwordHash } }),
  ]);
  ids = { admin: admin.id, member: member.id, otherMember: otherMember.id, professor: professor.id };
  tokens = {
    admin: await createToken(ids.admin),
    member: await createToken(ids.member),
    otherMember: await createToken(ids.otherMember),
    professor: await createToken(ids.professor),
  };
});

afterEach((context) => {
  if ('mock' in context) {
    context.mock.timers.reset();
  }
});

after(async () => { await prisma.$disconnect(); });

async function createPackageType(name: string, classCredits = 6, durationDays = 30, active = true) {
  return prisma.packageType.create({ data: { name, classCredits, durationDays, active } });
}

async function createPackageRecord(input: {
  memberId?: number;
  typeName: string;
  startsOn: string;
  expiresOn: string;
  remainingCredits: number;
}) {
  const packageType = await createPackageType(input.typeName);
  return prisma.memberPackage.create({
    data: {
      memberId: input.memberId ?? ids.member,
      packageTypeId: packageType.id,
      startsOn: toDatabaseDate(input.startsOn),
      expiresOn: toDatabaseDate(input.expiresOn),
      initialCredits: 6,
      remainingCredits: input.remainingCredits,
    },
  });
}

function assignmentBody(memberId: number, packageTypeId: number, startsOn = TODAY) {
  return { memberId, packageTypeId, startsOn };
}

test('HU-21: ADMIN asigna snapshots y permite fechas pasadas, presentes y futuras', async () => {
  const packageType = await createPackageType('Mensual', 8, 1);
  const dates = [addCalendarDays(TODAY, -1), TODAY, addCalendarDays(TODAY, 1)];
  const expectedStatuses = ['EXPIRED', 'ACTIVE', 'NOT_STARTED'];

  for (const [index, startsOn] of dates.entries()) {
    const response = await request(app).post('/api/v1/member-packages').set(auth()).send(
      assignmentBody(ids.member, packageType.id, startsOn),
    ).expect(201);

    assert.equal(response.body.data.startsOn, startsOn);
    assert.equal(response.body.data.expiresOn, startsOn);
    assert.equal(response.body.data.initialCredits, 8);
    assert.equal(response.body.data.remainingCredits, 8);
    assert.equal(response.body.data.status, expectedStatuses[index]);
    assert.equal(response.body.data.packageType.id, packageType.id);
    assert.match(response.body.data.assignedAt, /^\d{4}-\d{2}-\d{2}T.*Z$/);
  }
});

test('HU-21: valida permisos, body estricto y referencias de socio y tipo', async () => {
  const activeType = await createPackageType('Activo');
  const validBody = assignmentBody(ids.member, activeType.id);
  for (const role of ['member', 'professor'] as const) {
    await request(app).post('/api/v1/member-packages').set(auth(role)).send(validBody).expect(403);
  }

  for (const invalid of [
    { ...validBody, startsOn: '2030-02-30' },
    { ...validBody, startsOn: '15/06/2030' },
    { ...validBody, remainingCredits: 100 },
    { ...validBody, active: true },
  ]) {
    const response = await request(app).post('/api/v1/member-packages').set(auth()).send(invalid).expect(422);
    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  }

  const missingMember = await request(app).post('/api/v1/member-packages').set(auth()).send(
    assignmentBody(2147483647, activeType.id),
  ).expect(404);
  assert.equal(missingMember.body.error.code, 'MEMBER_NOT_FOUND');

  const invalidMember = await request(app).post('/api/v1/member-packages').set(auth()).send(
    assignmentBody(ids.professor, activeType.id),
  ).expect(409);
  assert.equal(invalidMember.body.error.code, 'INVALID_MEMBER');

  const inactiveMember = await prisma.user.create({ data: {
    name: 'Socio Inactivo', email: 'inactive@member-packages.test', role: 'MEMBER', active: false, passwordHash: 'fixture-hash',
  } });
  const inactiveUser = await request(app).post('/api/v1/member-packages').set(auth()).send(
    assignmentBody(inactiveMember.id, activeType.id),
  ).expect(409);
  assert.equal(inactiveUser.body.error.code, 'INACTIVE_USER');

  const missingType = await request(app).post('/api/v1/member-packages').set(auth()).send(
    assignmentBody(ids.member, 2147483647),
  ).expect(404);
  assert.equal(missingType.body.error.code, 'PACKAGE_TYPE_NOT_FOUND');

  const inactiveType = await createPackageType('Inactivo', 6, 30, false);
  const inactivePackageType = await request(app).post('/api/v1/member-packages').set(auth()).send(
    assignmentBody(ids.member, inactiveType.id),
  ).expect(409);
  assert.equal(inactivePackageType.body.error.code, 'INACTIVE_PACKAGE_TYPE');
});

test('HU-21: rechaza duplicados exactos, permite superposición y clasifica la carrera concurrente', async () => {
  const packageType = await createPackageType('Superpuesto', 6, 30);
  const created = await request(app).post('/api/v1/member-packages').set(auth()).send(
    assignmentBody(ids.member, packageType.id, TODAY),
  ).expect(201);

  const duplicate = await request(app).post('/api/v1/member-packages').set(auth()).send(
    assignmentBody(ids.member, packageType.id, TODAY),
  ).expect(409);
  assert.equal(duplicate.body.error.code, 'PACKAGE_ASSIGNMENT_EXISTS');

  const nextDay = addCalendarDays(TODAY, 1);
  const overlapping = await request(app).post('/api/v1/member-packages').set(auth()).send(
    assignmentBody(ids.member, packageType.id, nextDay),
  ).expect(201);
  assert.equal(overlapping.body.data.startsOn, nextDay);
  assert.ok(overlapping.body.data.startsOn <= created.body.data.expiresOn);

  const anotherType = await createPackageType('Otro Tipo');
  await request(app).post('/api/v1/member-packages').set(auth()).send(
    assignmentBody(ids.member, anotherType.id, TODAY),
  ).expect(201);

  const concurrentStart = addCalendarDays(TODAY, 2);
  const responses = await Promise.all([
    request(app).post('/api/v1/member-packages').set(auth()).send(assignmentBody(ids.member, packageType.id, concurrentStart)),
    request(app).post('/api/v1/member-packages').set(auth()).send(assignmentBody(ids.member, packageType.id, concurrentStart)),
  ]);
  assert.deepEqual(responses.map(({ status }) => status).sort(), [201, 409]);
  assert.equal(responses.find(({ status }) => status === 409)?.body.error.code, 'PACKAGE_ASSIGNMENT_EXISTS');
  assert.equal(await prisma.memberPackage.count({
    where: { memberId: ids.member, packageTypeId: packageType.id, startsOn: toDatabaseDate(concurrentStart) },
  }), 1);
});

test('HU-22: filtros derivados, expiringSoon 0/7/8, prioridad y total se resuelven antes de paginar', async () => {
  const today = TODAY;
  const rows = [
    { typeName: 'No iniciado sin saldo', startsOn: addCalendarDays(today, 1), expiresOn: addCalendarDays(today, 3), remainingCredits: 0, status: 'NOT_STARTED' },
    { typeName: 'Vencido sin saldo', startsOn: addCalendarDays(today, -3), expiresOn: addCalendarDays(today, -1), remainingCredits: 0, status: 'EXPIRED' },
    { typeName: 'Agotado vigente', startsOn: addCalendarDays(today, -1), expiresOn: addCalendarDays(today, 1), remainingCredits: 0, status: 'EXHAUSTED' },
    { typeName: 'Vence hoy', startsOn: today, expiresOn: today, remainingCredits: 2, status: 'ACTIVE' },
    { typeName: 'Vence en siete', startsOn: today, expiresOn: addCalendarDays(today, 7), remainingCredits: 2, status: 'ACTIVE' },
    { typeName: 'Vence en ocho', startsOn: today, expiresOn: addCalendarDays(today, 8), remainingCredits: 2, status: 'ACTIVE' },
    { typeName: 'Vence luego', startsOn: today, expiresOn: addCalendarDays(today, 30), remainingCredits: 2, status: 'ACTIVE' },
  ];
  const expectedIds = new Map<string, number>();
  for (const row of rows) {
    const created = await createPackageRecord(row);
    expectedIds.set(row.typeName, created.id);
  }

  for (const row of rows) {
    const response = await request(app).get(`/api/v1/member-packages?status=${row.status}`).set(auth()).expect(200);
    assert.ok(response.body.data.some((item: { id: number }) => item.id === expectedIds.get(row.typeName)));
  }

  const soon = await request(app).get('/api/v1/member-packages?expiringSoon=true').set(auth()).expect(200);
  assert.equal(soon.body.meta.total, 2);
  assert.deepEqual(soon.body.data.map((item: { expiresOn: string }) => item.expiresOn), [today, addCalendarDays(today, 7)]);
  assert.equal(soon.body.data.every((item: { status: string; expiringSoon: boolean }) => item.status === 'ACTIVE' && item.expiringSoon), true);

  const notSoon = await request(app).get('/api/v1/member-packages?expiringSoon=false').set(auth()).expect(200);
  assert.equal(notSoon.body.meta.total, 5);
  assert.equal(notSoon.body.data.some((item: { id: number }) => item.id === expectedIds.get('Vence en ocho')), true);

  const activePageOne = await request(app).get('/api/v1/member-packages?status=ACTIVE&page=1&pageSize=2').set(auth()).expect(200);
  const activePageTwo = await request(app).get('/api/v1/member-packages?status=ACTIVE&page=2&pageSize=2').set(auth()).expect(200);
  assert.equal(activePageOne.body.meta.total, 4);
  assert.equal(activePageTwo.body.meta.total, 4);
  assert.equal(activePageOne.body.data.length, 2);
  assert.equal(activePageTwo.body.data.length, 2);
  assert.deepEqual(activePageOne.body.data.map((item: { expiresOn: string }) => item.expiresOn), [today, addCalendarDays(today, 7)]);
  assert.deepEqual(activePageTwo.body.data.map((item: { expiresOn: string }) => item.expiresOn), [addCalendarDays(today, 8), addCalendarDays(today, 30)]);
});

test('HU-22/HU-23: ADMIN filtra y consulta cualquiera; MEMBER solo ve los propios; PROFESSOR recibe 403', async () => {
  const packageType = await createPackageType('Propio');
  const own = await request(app).post('/api/v1/member-packages').set(auth()).send(
    assignmentBody(ids.member, packageType.id),
  ).expect(201);
  const other = await request(app).post('/api/v1/member-packages').set(auth()).send(
    assignmentBody(ids.otherMember, packageType.id),
  ).expect(201);

  const adminFiltered = await request(app).get(`/api/v1/member-packages?memberId=${ids.otherMember}`).set(auth()).expect(200);
  assert.equal(adminFiltered.body.meta.total, 1);
  assert.equal(adminFiltered.body.data[0].member.id, ids.otherMember);

  const memberList = await request(app).get(`/api/v1/member-packages?memberId=${ids.otherMember}`).set(auth('member')).expect(200);
  assert.equal(memberList.body.meta.total, 1);
  assert.equal(memberList.body.data[0].member.id, ids.member);
  assert.equal(memberList.body.data[0].id, own.body.data.id);

  await request(app).get(`/api/v1/member-packages/${own.body.data.id}`).set(auth('member')).expect(200);
  const foreign = await request(app).get(`/api/v1/member-packages/${other.body.data.id}`).set(auth('member')).expect(403);
  assert.equal(foreign.body.error.code, 'FORBIDDEN');
  await request(app).get(`/api/v1/member-packages/${other.body.data.id}`).set(auth()).expect(200);
  const missing = await request(app).get('/api/v1/member-packages/2147483647').set(auth('member')).expect(404);
  assert.equal(missing.body.error.code, 'NOT_FOUND');

  await request(app).get('/api/v1/member-packages').set(auth('professor')).expect(403);
  await request(app).get(`/api/v1/member-packages/${own.body.data.id}`).set(auth('professor')).expect(403);
  await request(app).post('/api/v1/member-packages').set(auth('professor')).send(
    assignmentBody(ids.member, packageType.id, addCalendarDays(TODAY, 1)),
  ).expect(403);
});

test('HU-21/HU-22: cambiar el tipo conserva snapshots y muestra su nombre actual', async () => {
  const packageType = await createPackageType('Original', 9, 10);
  const assigned = await request(app).post('/api/v1/member-packages').set(auth()).send(
    assignmentBody(ids.member, packageType.id),
  ).expect(201);
  const before = assigned.body.data;

  await prisma.packageType.update({ where: { id: packageType.id }, data: {
    name: 'Actualizado', classCredits: 20, durationDays: 60, active: false,
  } });

  const detail = await request(app).get(`/api/v1/member-packages/${before.id}`).set(auth()).expect(200);
  assert.equal(detail.body.data.packageType.name, 'Actualizado');
  assert.equal(detail.body.data.initialCredits, 9);
  assert.equal(detail.body.data.remainingCredits, 9);
  assert.equal(detail.body.data.startsOn, before.startsOn);
  assert.equal(detail.body.data.expiresOn, addCalendarDays(TODAY, 9));
});

test('HU-22/HU-23: valida filtros de listado sin aceptar parámetros desconocidos', async () => {
  for (const query of ['page=0', 'pageSize=101', 'status=UNKNOWN', 'expiringSoon=TRUE', 'other=1']) {
    const response = await request(app).get(`/api/v1/member-packages?${query}`).set(auth()).expect(400);
    assert.equal(response.body.error.code, 'INVALID_REQUEST');
  }
});
