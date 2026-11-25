import { after, afterEach, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { env } from '../src/config/env.js';
import { createToken } from '../src/shared/token.js';
import { hashPassword } from '../src/shared/password.js';
import { toDatabaseDate } from '../src/modules/member-packages/member-packages.dates.js';

if (env.NODE_ENV !== 'test' || new URL(env.DATABASE_URL).pathname !== '/gymflow_test') throw new Error('Se requiere la base desechable gymflow_test.');
const app = createApp();
const NOW = new Date('2030-06-15T15:00:00.000Z');
const TODAY = '2030-06-15';
type RoleKey = 'admin' | 'member' | 'other' | 'professor';
let ids: Record<RoleKey, number>;
let tokens: Record<RoleKey, string>;
let activityId: number;
const auth = (role: RoleKey = 'admin') => ({ Authorization: `Bearer ${tokens[role]}` });
const future = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000);

before(async () => { await prisma.$connect(); });
beforeEach(async (context) => {
  if (!('mock' in context)) throw new Error('Se esperaba el contexto de prueba para fijar el reloj.');
  context.mock.timers.enable({ apis: ['Date'], now: NOW });
  await prisma.$transaction([
    prisma.enrollment.deleteMany(), prisma.memberPackage.deleteMany(), prisma.class.deleteMany(),
    prisma.packageType.deleteMany(), prisma.activity.deleteMany(), prisma.user.deleteMany(),
  ]);
  const passwordHash = await hashPassword(randomBytes(24).toString('hex'));
  const [admin, member, other, professor] = await Promise.all([
    prisma.user.create({ data: { name: 'Admin Inscripciones', email: 'admin@enrollments.test', role: 'ADMIN', passwordHash } }),
    prisma.user.create({ data: { name: 'Socio Inscripciones', email: 'member@enrollments.test', role: 'MEMBER', passwordHash } }),
    prisma.user.create({ data: { name: 'Otro Socio', email: 'other@enrollments.test', role: 'MEMBER', passwordHash } }),
    prisma.user.create({ data: { name: 'Profesor', email: 'professor@enrollments.test', role: 'PROFESSOR', passwordHash } }),
  ]);
  ids = { admin: admin.id, member: member.id, other: other.id, professor: professor.id };
  tokens = {
    admin: await createToken(admin.id), member: await createToken(member.id),
    other: await createToken(other.id), professor: await createToken(professor.id),
  };
  activityId = (await prisma.activity.create({ data: { name: 'Yoga' } })).id;
});
afterEach((context) => { if ('mock' in context) context.mock.timers.reset(); });
after(async () => { await prisma.$disconnect(); });

async function createClass(start = future(24), capacity = 5, endsAt = new Date(start.getTime() + 3_600_000)) {
  return prisma.class.create({ data: { activityId, professorId: ids.professor, startsAt: start, endsAt, capacity } });
}
async function createPackage(memberId = ids.member, options: { startsOn?: string; expiresOn?: string; credits?: number; assignedAt?: Date; typeActive?: boolean } = {}) {
  const type = await prisma.packageType.create({ data: { name: `Pack ${randomBytes(4).toString('hex')}`, classCredits: 5, durationDays: 30, active: options.typeActive ?? true } });
  return prisma.memberPackage.create({ data: {
    memberId, packageTypeId: type.id, startsOn: toDatabaseDate(options.startsOn ?? TODAY),
    expiresOn: toDatabaseDate(options.expiresOn ?? '2030-07-15'), initialCredits: 5,
    remainingCredits: options.credits ?? 5, ...(options.assignedAt ? { assignedAt: options.assignedAt } : {}),
  } });
}
function enrollAs(role: RoleKey, classId: number, memberId?: number) {
  return request(app).post('/api/v1/enrollments').set(auth(role)).send({ classId, ...(memberId === undefined ? {} : { memberId }) });
}
function expectCode(response: { body: { error?: { code?: string } } }, code: string) { assert.equal(response.body.error?.code, code); }

function assertRecord(value: unknown): asserts value is Record<string, unknown> {
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value));
}

function assertIsoInstant(value: unknown) {
  assert.equal(typeof value, 'string');
  assert.equal(new Date(value as string).toISOString(), value);
}

function expectEnrollmentView(value: unknown, expectedPackageCredits?: number) {
  assertRecord(value);
  assert.deepEqual(Object.keys(value).sort(), [
    'id', 'classId', 'memberId', 'memberPackageId', 'cancelled', 'cancelledAt', 'creditRefunded',
    'attendanceStatus', 'attendanceRecordedBy', 'attendanceRecordedAt', 'createdAt', 'member', 'class', 'memberPackage',
  ].sort());
  assertIsoInstant(value.createdAt);
  if (value.cancelledAt !== null) assertIsoInstant(value.cancelledAt);
  if (value.attendanceRecordedAt !== null) assertIsoInstant(value.attendanceRecordedAt);
  assert.ok(['PENDING', 'PRESENT', 'ABSENT'].includes(String(value.attendanceStatus)));

  assertRecord(value.member);
  assert.deepEqual(Object.keys(value.member).sort(), ['id', 'name']);
  assert.equal('email' in value.member, false);

  assertRecord(value.class);
  assert.deepEqual(Object.keys(value.class).sort(), ['startsAt', 'endsAt', 'cancelled', 'activity', 'professor'].sort());
  assertIsoInstant(value.class.startsAt);
  assertIsoInstant(value.class.endsAt);
  assert.equal('activityId' in value.class, false);
  assert.equal('professorId' in value.class, false);
  assert.equal('_count' in value.class, false);
  assertRecord(value.class.activity);
  assert.deepEqual(Object.keys(value.class.activity).sort(), ['id', 'name']);
  assertRecord(value.class.professor);
  assert.deepEqual(Object.keys(value.class.professor).sort(), ['id', 'name']);

  assertRecord(value.memberPackage);
  assert.deepEqual(Object.keys(value.memberPackage).sort(), ['packageType', 'remainingCredits']);
  assertRecord(value.memberPackage.packageType);
  assert.deepEqual(Object.keys(value.memberPackage.packageType).sort(), ['id', 'name']);
  if (expectedPackageCredits !== undefined) assert.equal(value.memberPackage.remainingCredits, expectedPackageCredits);
  assert.equal('package' in value, false);
}

function expectEligibilityView(value: unknown) {
  assertRecord(value);
  assert.deepEqual(Object.keys(value).sort(), ['canEnroll', 'reasonCode', 'message', 'selectedPackage', 'expectedRemainingCredits'].sort());
  for (const field of ['reason', 'memberPackageId', 'packageTypeName', 'remainingCredits', 'remainingCreditsAfterEnrollment']) {
    assert.equal(field in value, false);
  }
}

test('HU-24: elegibilidad no muta, MEMBER y ADMIN crean con selección automática priorizada y débito exacto', async () => {
  const klass = await createClass();
  const later = await createPackage(ids.member, { expiresOn: '2030-07-10', credits: 4, assignedAt: new Date('2030-06-10T12:00:00Z') });
  const earlier = await createPackage(ids.member, { expiresOn: '2030-06-25', credits: 3, assignedAt: new Date('2030-06-12T12:00:00Z'), typeActive: false });
  const preview = await request(app).get(`/api/v1/classes/${klass.id}/eligibility`).set(auth('member')).expect(200);
  expectEligibilityView(preview.body.data);
  assert.equal(preview.body.data.canEnroll, true);
  assert.equal(preview.body.data.selectedPackage.id, earlier.id);
  assert.equal(preview.body.data.selectedPackage.remainingCredits, 3);
  assert.equal(preview.body.data.expectedRemainingCredits, 2);
  assert.equal((await prisma.memberPackage.findUniqueOrThrow({ where: { id: earlier.id } })).remainingCredits, 3);
  const created = await enrollAs('member', klass.id).expect(201);
  expectEnrollmentView(created.body.data, 2);
  assert.equal(created.body.data.memberPackageId, earlier.id);
  assert.equal((await prisma.memberPackage.findUniqueOrThrow({ where: { id: earlier.id } })).remainingCredits, 2);
  assert.equal((await prisma.memberPackage.findUniqueOrThrow({ where: { id: later.id } })).remainingCredits, 4);

  const adminClass = await createClass(future(30));
  const adminPack = await createPackage(ids.other);
  const adminCreated = await enrollAs('admin', adminClass.id, ids.other).expect(201);
  expectEnrollmentView(adminCreated.body.data, 4);
  assert.equal(adminCreated.body.data.memberId, ids.other);
  assert.equal(adminCreated.body.data.memberPackageId, adminPack.id);
});

test('HU-24: selección desempata por assignedAt e ID y exige que paquete cubra hoy y fecha de clase', async () => {
  const klass = await createClass(future(72));
  const tiedLaterId = await createPackage(ids.member, { expiresOn: '2030-06-25', assignedAt: new Date('2030-06-10T12:00:00Z') });
  const tiedEarlierId = await createPackage(ids.member, { expiresOn: '2030-06-25', assignedAt: new Date('2030-06-10T12:00:00Z') });
  const startsAfterClassDate = await createPackage(ids.member, { startsOn: '2030-06-19', expiresOn: '2030-07-20' });
  const expiresBeforeClassDate = await createPackage(ids.member, { startsOn: TODAY, expiresOn: '2030-06-16' });
  const preview = await request(app).get(`/api/v1/classes/${klass.id}/eligibility`).set(auth('admin')).query({ memberId: ids.member }).expect(200);
  expectEligibilityView(preview.body.data);
  assert.equal(preview.body.data.selectedPackage.id, Math.min(tiedLaterId.id, tiedEarlierId.id));
  assert.notEqual(preview.body.data.selectedPackage.id, startsAfterClassDate.id);
  assert.notEqual(preview.body.data.selectedPackage.id, expiresBeforeClassDate.id);
});

test('HU-24: elegibilidad expresa causas de negocio en 200 y valida identidad y referencias', async () => {
  const full = await createClass(future(24), 0 + 1);
  const occupiedPack = await createPackage(ids.other);
  await prisma.enrollment.create({ data: { classId: full.id, memberId: ids.other, memberPackageId: occupiedPack.id } });
  const fullResult = await request(app).get(`/api/v1/classes/${full.id}/eligibility`).set(auth('member')).expect(200);
  expectEligibilityView(fullResult.body.data);
  assert.equal(fullResult.body.data.reasonCode, 'CLASS_FULL');
  const cancelled = await createClass(future(28));
  await prisma.class.update({ where: { id: cancelled.id }, data: { cancelled: true } });
  const cancelledEligibility = await request(app).get(`/api/v1/classes/${cancelled.id}/eligibility`).set(auth('member')).expect(200);
  expectEligibilityView(cancelledEligibility.body.data);
  assert.equal(cancelledEligibility.body.data.reasonCode, 'CLASS_CANCELLED');
  const cancelledPost = await enrollAs('member', cancelled.id).expect(409); expectCode(cancelledPost, 'CLASS_CANCELLED');
  const started = await createClass(new Date(NOW.getTime() - 1_000));
  const startedEligibility = await request(app).get(`/api/v1/classes/${started.id}/eligibility`).set(auth('member')).expect(200);
  expectEligibilityView(startedEligibility.body.data);
  assert.equal(startedEligibility.body.data.reasonCode, 'CLASS_STARTED');
  const noPackClass = await createClass(future(32));
  const noPackageEligibility = await request(app).get(`/api/v1/classes/${noPackClass.id}/eligibility`).set(auth('member')).expect(200);
  expectEligibilityView(noPackageEligibility.body.data);
  assert.equal(noPackageEligibility.body.data.reasonCode, 'NO_USABLE_PACKAGE');
  await request(app).get(`/api/v1/classes/${noPackClass.id}/eligibility`).set(auth('admin')).expect(400);
  await request(app).get(`/api/v1/classes/${noPackClass.id}/eligibility`).set(auth('member')).query({ memberId: ids.other }).expect(403);
  await request(app).get(`/api/v1/classes/${noPackClass.id}/eligibility`).set(auth('professor')).expect(403);
  const invalidClassId = await request(app).get('/api/v1/classes/nope/eligibility').set(auth('member')).expect(400);
  expectCode(invalidClassId, 'INVALID_REQUEST');
  const missingClass = await request(app).get('/api/v1/classes/2147483647/eligibility').set(auth('member')).expect(404);
  expectCode(missingClass, 'NOT_FOUND');
  await request(app).get(`/api/v1/classes/${noPackClass.id}/eligibility`).set(auth('admin')).query({ memberId: 2147483647 }).expect(404).expect(({ body }) => expectCode({ body }, 'MEMBER_NOT_FOUND'));
  await request(app).get(`/api/v1/classes/${noPackClass.id}/eligibility`).set(auth('admin')).query({ memberId: ids.professor }).expect(409).expect(({ body }) => expectCode({ body }, 'INVALID_MEMBER'));
});

test('HU-24: alta valida roles, payload estricto, socio activo y elegibilidad; mantiene relación original', async () => {
  const klass = await createClass();
  const pack = await createPackage();
  await enrollAs('professor', klass.id).expect(403);
  await enrollAs('member', klass.id, ids.other).expect(403);
  const adminWithoutMember = await enrollAs('admin', klass.id).expect(422); expectCode(adminWithoutMember, 'VALIDATION_ERROR');
  const extra = await request(app).post('/api/v1/enrollments').set(auth('member')).send({ classId: klass.id, memberPackageId: pack.id }).expect(422);
  expectCode(extra, 'VALIDATION_ERROR');
  const missingMember = await enrollAs('admin', klass.id, 2147483647).expect(404); expectCode(missingMember, 'MEMBER_NOT_FOUND');
  const wrongRole = await enrollAs('admin', klass.id, ids.professor).expect(409); expectCode(wrongRole, 'INVALID_MEMBER');
  const inactive = await prisma.user.create({ data: { name: 'Inactivo', email: 'inactive@enrollments.test', role: 'MEMBER', active: false, passwordHash: 'fixture' } });
  const inactiveResult = await enrollAs('admin', klass.id, inactive.id).expect(409); expectCode(inactiveResult, 'INACTIVE_USER');
  const result = await enrollAs('admin', klass.id, ids.member).expect(201);
  expectEnrollmentView(result.body.data, 4);
  assert.equal(result.body.data.memberPackageId, pack.id);
  assert.equal(result.body.data.cancelled, false);
  assert.equal(result.body.data.creditRefunded, false);
  assert.equal((await prisma.memberPackage.findUniqueOrThrow({ where: { id: pack.id } })).remainingCredits, 4);
});

test('HU-24: rechaza clase terminada, cupo completo y duplicado activo incluso con otro paquete', async () => {
  const full = await createClass(future(20), 1);
  const firstPack = await createPackage(ids.other);
  await prisma.enrollment.create({ data: { classId: full.id, memberId: ids.other, memberPackageId: firstPack.id } });
  const fullResponse = await enrollAs('member', full.id).expect(409); expectCode(fullResponse, 'CLASS_FULL');
  const finished = await createClass(new Date(NOW.getTime() - 3_600_000), 4, new Date(NOW.getTime() - 1_000));
  const finishedResponse = await enrollAs('member', finished.id).expect(409); expectCode(finishedResponse, 'CLASS_STARTED');
  const klass = await createClass();
  const packageOne = await createPackage();
  const packageTwo = await createPackage(ids.member);
  await prisma.enrollment.create({ data: { classId: klass.id, memberId: ids.member, memberPackageId: packageOne.id } });
  const duplicateEligibility = await request(app).get(`/api/v1/classes/${klass.id}/eligibility`).set(auth('member')).expect(200);
  assert.equal(duplicateEligibility.body.data.reasonCode, 'ALREADY_ENROLLED');
  const duplicate = await enrollAs('member', klass.id).expect(409);
  assert.equal(duplicate.body.error.code, 'ALREADY_ENROLLED');
  assert.equal((await prisma.memberPackage.findUniqueOrThrow({ where: { id: packageTwo.id } })).remainingCredits, 5);
});

test('HU-24: dos socios compiten por último cupo; solo una inscripción confirma', async () => {
  const klass = await createClass(future(24), 1);
  const [firstPack, secondPack] = await Promise.all([createPackage(ids.member), createPackage(ids.other)]);
  const results = await Promise.all([enrollAs('member', klass.id), enrollAs('admin', klass.id, ids.other)]);
  assert.deepEqual(results.map(({ status }) => status).sort(), [201, 409]);
  const winner = results.find(({ status }) => status === 201)!;
  assert.equal(winner.body.data.cancelled, false);
  assert.equal(await prisma.enrollment.count({ where: { classId: klass.id, cancelled: false } }), 1);
  const balances = await prisma.memberPackage.findMany({ where: { id: { in: [firstPack.id, secondPack.id] } }, orderBy: { id: 'asc' }, select: { remainingCredits: true } });
  assert.deepEqual(balances.map(({ remainingCredits }) => remainingCredits).sort(), [4, 5]);
});

test('HU-24: duplicado concurrente y un crédito compitiendo entre clases nunca generan doble débito', async () => {
  const klass = await createClass();
  const pack = await createPackage(ids.member, { credits: 1 });
  const duplicateResponses = await Promise.all([enrollAs('member', klass.id), enrollAs('member', klass.id)]);
  assert.deepEqual(duplicateResponses.map(({ status }) => status).sort(), [201, 409]);
  const duplicateConflict = duplicateResponses.find(({ status }) => status === 409);
  assert.equal(duplicateConflict?.body.error.code, 'ALREADY_ENROLLED');
  assert.equal(await prisma.enrollment.count({ where: { classId: klass.id, memberId: ids.member, cancelled: false } }), 1);
  assert.equal((await prisma.memberPackage.findUniqueOrThrow({ where: { id: pack.id } })).remainingCredits, 0);

  const otherPack = await createPackage(ids.other, { credits: 1 });
  const classOne = await createClass(future(30));
  const classTwo = await createClass(future(36));
  const competingPack = await createPackage(ids.member, { credits: 1, expiresOn: '2030-08-01' });
  const competing = await Promise.all([enrollAs('member', classOne.id), enrollAs('member', classTwo.id)]);
  assert.deepEqual(competing.map(({ status }) => status).sort(), [201, 409]);
  assert.equal((await prisma.memberPackage.findUniqueOrThrow({ where: { id: competingPack.id } })).remainingCredits, 0);
  assert.equal(await prisma.enrollment.count({ where: { memberId: ids.member, memberPackageId: competingPack.id, cancelled: false } }), 1);
  assert.equal((await prisma.memberPackage.findUniqueOrThrow({ where: { id: otherPack.id } })).remainingCredits, 1);
});

test('HU-25: cancela exactamente dos horas antes, reintegra al paquete original una vez y permite reinscripción', async () => {
  const klass = await createClass(future(2));
  const original = await createPackage(ids.member, { credits: 2 });
  const enrollment = await prisma.enrollment.create({ data: { classId: klass.id, memberId: ids.member, memberPackageId: original.id } });
  const cancelled = await request(app).post(`/api/v1/enrollments/${enrollment.id}/cancel`).set(auth('member')).send({}).expect(200);
  expectEnrollmentView(cancelled.body.data, 3);
  assert.equal(cancelled.body.data.cancelled, true);
  assert.equal(cancelled.body.data.creditRefunded, true);
  assert.ok(cancelled.body.data.cancelledAt);
  assert.equal((await prisma.memberPackage.findUniqueOrThrow({ where: { id: original.id } })).remainingCredits, 3);
  assert.equal(await prisma.enrollment.count({ where: { id: enrollment.id } }), 1);
  const repeat = await request(app).post(`/api/v1/enrollments/${enrollment.id}/cancel`).set(auth('member')).send({}).expect(409);
  expectCode(repeat, 'ALREADY_CANCELLED');
  assert.equal((await prisma.memberPackage.findUniqueOrThrow({ where: { id: original.id } })).remainingCredits, 3);
  const reenrolled = await enrollAs('member', klass.id).expect(201);
  assert.equal(reenrolled.body.data.memberPackageId, original.id);
  assert.equal((await prisma.memberPackage.findUniqueOrThrow({ where: { id: original.id } })).remainingCredits, 2);

  const boundaryActivity = await prisma.activity.create({ data: { name: 'Pilates boundary' } });
  const adminBoundaryClass = await prisma.class.create({ data: {
    activityId: boundaryActivity.id, professorId: ids.professor, startsAt: future(2),
    endsAt: future(3), capacity: 2,
  } });
  const adminBoundaryPackage = await createPackage(ids.other, { credits: 1 });
  const adminBoundaryEnrollment = await prisma.enrollment.create({ data: { classId: adminBoundaryClass.id, memberId: ids.other, memberPackageId: adminBoundaryPackage.id } });
  await request(app).post(`/api/v1/enrollments/${adminBoundaryEnrollment.id}/cancel`).set(auth()).send({}).expect(200);
  assert.equal((await prisma.memberPackage.findUniqueOrThrow({ where: { id: adminBoundaryPackage.id } })).remainingCredits, 2);
});

test('HU-25: a 1 h 59 min 59 s rechaza cancelación sin mutar cupo ni saldo, incluso para ADMIN', async () => {
  const klass = await createClass(new Date(NOW.getTime() + 7_199_000), 1);
  const pack = await createPackage(ids.member, { credits: 3 });
  const enrollment = await prisma.enrollment.create({ data: { classId: klass.id, memberId: ids.member, memberPackageId: pack.id } });
  const response = await request(app).post(`/api/v1/enrollments/${enrollment.id}/cancel`).set(auth()).send({}).expect(409);
  expectCode(response, 'CANCELLATION_WINDOW_CLOSED');
  assert.deepEqual(await prisma.enrollment.findUniqueOrThrow({ where: { id: enrollment.id }, select: { cancelled: true, creditRefunded: true, cancelledAt: true } }), { cancelled: false, creditRefunded: false, cancelledAt: null });
  assert.equal((await prisma.memberPackage.findUniqueOrThrow({ where: { id: pack.id } })).remainingCredits, 3);
  assert.equal(await prisma.enrollment.count({ where: { classId: klass.id, cancelled: false } }), 1);
});

test('HU-25: un fallo al reintegrar revierte también el marcado de cancelación', async () => {
  const klass = await createClass(future(2));
  const type = await prisma.packageType.create({ data: { name: 'Límite entero', classCredits: 2147483647, durationDays: 30 } });
  const pack = await prisma.memberPackage.create({ data: {
    memberId: ids.member, packageTypeId: type.id, startsOn: toDatabaseDate(TODAY),
    expiresOn: toDatabaseDate('2030-07-15'), initialCredits: 2147483647,
    remainingCredits: 2147483647,
  } });
  const enrollment = await prisma.enrollment.create({ data: { classId: klass.id, memberId: ids.member, memberPackageId: pack.id } });
  await request(app).post(`/api/v1/enrollments/${enrollment.id}/cancel`).set(auth('member')).send({}).expect(500);
  assert.deepEqual(await prisma.enrollment.findUniqueOrThrow({ where: { id: enrollment.id }, select: { cancelled: true, cancelledAt: true, creditRefunded: true } }), {
    cancelled: false, cancelledAt: null, creditRefunded: false,
  });
  assert.equal((await prisma.memberPackage.findUniqueOrThrow({ where: { id: pack.id } })).remainingCredits, 2147483647);
});

test('HU-25: permisos, propiedad y cancelación administrativa de clase son consistentes', async () => {
  const klass = await createClass();
  const ownerPack = await createPackage(ids.member, { credits: 2 });
  const foreignPack = await createPackage(ids.other, { credits: 2 });
  const own = await prisma.enrollment.create({ data: { classId: klass.id, memberId: ids.member, memberPackageId: ownerPack.id } });
  const foreign = await prisma.enrollment.create({ data: { classId: klass.id, memberId: ids.other, memberPackageId: foreignPack.id } });
  await request(app).post(`/api/v1/enrollments/${own.id}/cancel`).set(auth('professor')).send({}).expect(403);
  await request(app).post(`/api/v1/enrollments/${foreign.id}/cancel`).set(auth('member')).send({}).expect(403);
  await request(app).get('/api/v1/enrollments').set(auth('professor')).expect(403);
  await request(app).get(`/api/v1/enrollments/${own.id}`).set(auth('professor')).expect(403);
  await request(app).post('/api/v1/enrollments').set(auth('professor')).send({ classId: klass.id }).expect(403);
  await request(app).post(`/api/v1/classes/${klass.id}/cancel`).set(auth()).send({}).expect(200);
  assert.equal((await prisma.enrollment.findUniqueOrThrow({ where: { id: own.id } })).cancelled, true);
  assert.equal((await prisma.enrollment.findUniqueOrThrow({ where: { id: foreign.id } })).creditRefunded, true);
  assert.equal((await prisma.memberPackage.findUniqueOrThrow({ where: { id: ownerPack.id } })).remainingCredits, 3);
  const afterClassCancel = await enrollAs('member', klass.id).expect(409); expectCode(afterClassCancel, 'CLASS_CANCELLED');
});

test('HU-26: listado filtra, pagina y ordena; MEMBER queda aislado y detalle ajeno da 403', async () => {
  const firstClass = await createClass(future(24));
  const secondClass = await createClass(future(30));
  const thirdClass = await createClass(future(36));
  const [ownPack, otherPack] = await Promise.all([createPackage(ids.member), createPackage(ids.other)]);
  const ownFirst = await prisma.enrollment.create({ data: { classId: firstClass.id, memberId: ids.member, memberPackageId: ownPack.id } });
  const ownSecond = await prisma.enrollment.create({ data: { classId: secondClass.id, memberId: ids.member, memberPackageId: ownPack.id } });
  const foreign = await prisma.enrollment.create({ data: { classId: thirdClass.id, memberId: ids.other, memberPackageId: otherPack.id } });
  // from is inclusive; to is exclusive, so the third class starts exactly at the excluded boundary.
  const adminPage = await request(app).get(`/api/v1/enrollments?page=1&pageSize=1&from=2030-06-16T00:00:00.000Z&to=${encodeURIComponent(thirdClass.startsAt.toISOString())}`).set(auth()).expect(200);
  assert.equal(adminPage.body.meta.total, 2);
  expectEnrollmentView(adminPage.body.data[0]);
  assert.equal(adminPage.body.data[0].id, ownFirst.id);
  const adminFiltered = await request(app).get(`/api/v1/enrollments?memberId=${ids.other}&classId=${thirdClass.id}&cancelled=false`).set(auth()).expect(200);
  assert.equal(adminFiltered.body.meta.total, 1);
  expectEnrollmentView(adminFiltered.body.data[0]);
  assert.equal(adminFiltered.body.data[0].id, foreign.id);
  const memberList = await request(app).get(`/api/v1/enrollments?memberId=${ids.other}`).set(auth('member')).expect(200);
  assert.deepEqual(memberList.body.data.map((row: { id: number }) => row.id), [ownFirst.id, ownSecond.id]);
  expectEnrollmentView(memberList.body.data[0]);
  const ownDetail = await request(app).get(`/api/v1/enrollments/${ownFirst.id}`).set(auth('member')).expect(200);
  expectEnrollmentView(ownDetail.body.data);
  const foreignDetail = await request(app).get(`/api/v1/enrollments/${foreign.id}`).set(auth('member')).expect(403); expectCode(foreignDetail, 'FORBIDDEN');
  await request(app).get('/api/v1/enrollments/2147483647').set(auth()).expect(404);
  await request(app).get('/api/v1/enrollments/not-an-id').set(auth()).expect(400);
  await request(app).get('/api/v1/enrollments?page=0').set(auth()).expect(400);
  await request(app).get('/api/v1/enrollments?cancelled=maybe').set(auth()).expect(400);
  const cancelledRows = await request(app).get('/api/v1/enrollments?cancelled=false').set(auth()).expect(200);
  assert.equal(cancelledRows.body.meta.total, 3);
});

