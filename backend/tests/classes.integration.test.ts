import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { env } from '../src/config/env.js';
import { createToken } from '../src/shared/token.js';
import { hashPassword } from '../src/shared/password.js';

if (env.NODE_ENV !== 'test' || new URL(env.DATABASE_URL).pathname !== '/gymflow_test') throw new Error('Se requiere la base desechable gymflow_test.');
const app = createApp();
const future = (hours: number) => new Date(Date.now() + hours * 3_600_000);
const roles = ['ADMIN', 'MEMBER', 'PROFESSOR'] as const;
let ids: { admin: number; member: number; professor: number; otherProfessor: number };
let tokens: Record<'admin' | 'member' | 'professor', string>;
let activityId: number;
const auth = (role: keyof typeof tokens = 'admin') => ({ Authorization: `Bearer ${tokens[role]}` });
async function createClass(capacity = 5, startsAt = future(24)) {
  return prisma.class.create({ data: { activityId, professorId: ids.professor, startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000), capacity } });
}

before(async () => { await prisma.$connect(); });
beforeEach(async () => {
  await prisma.$transaction([prisma.enrollment.deleteMany(), prisma.memberPackage.deleteMany(), prisma.class.deleteMany(), prisma.packageType.deleteMany(), prisma.activity.deleteMany(), prisma.user.deleteMany()]);
  const hash = await hashPassword(randomBytes(24).toString('hex'));
  const [admin, member, professor, otherProfessor] = await Promise.all(roles.map((role, index) => prisma.user.create({ data: { name: `Usuario ${role}`, email: `${role.toLowerCase()}@classes.test`, role, passwordHash: hash } })).concat([prisma.user.create({ data: { name: 'Otro profesor', email: 'otro@classes.test', role: 'PROFESSOR', passwordHash: hash } })]));
  ids = { admin: admin.id, member: member.id, professor: professor.id, otherProfessor: otherProfessor.id };
  tokens = { admin: await createToken(admin.id), member: await createToken(member.id), professor: await createToken(professor.id) };
  activityId = (await prisma.activity.create({ data: { name: 'Yoga' } })).id;
});
after(async () => { await prisma.$disconnect(); });

test('HU-13: ADMIN crea clase; otros roles reciben 403 y referencias inválidas se rechazan', async () => {
  const body = { activityId, professorId: ids.professor, startsAt: future(30).toISOString(), endsAt: future(31).toISOString(), capacity: 8 };
  await request(app).post('/api/v1/classes').set(auth('member')).send(body).expect(403);
  await request(app).post('/api/v1/classes').set(auth('professor')).send(body).expect(403);
  const created = await request(app).post('/api/v1/classes').set(auth()).send(body).expect(201);
  assert.equal(created.body.data.availableSpots, 8);
  for (const invalid of [{ ...body, capacity: 0 }, { ...body, startsAt: 'mañana' }, { ...body, endsAt: future(29).toISOString() }, { ...body, activityId: 2147483647 }, { ...body, professorId: 2147483647 }]) await request(app).post('/api/v1/classes').set(auth()).send(invalid).expect(invalid.activityId === 2147483647 || invalid.professorId === 2147483647 ? 404 : 422);
  const inactiveActivity = await prisma.activity.create({ data: { name: 'Inactiva', active: false } });
  await request(app).post('/api/v1/classes').set(auth()).send({ ...body, activityId: inactiveActivity.id }).expect(409);
  const inactiveProfessor = await prisma.user.create({ data: { name: 'Inactivo', email: 'inactive@classes.test', role: 'PROFESSOR', active: false, passwordHash: 'hash' } });
  await request(app).post('/api/v1/classes').set(auth()).send({ ...body, professorId: inactiveProfessor.id }).expect(409);
  await request(app).post('/api/v1/classes').set(auth()).send({ ...body, professorId: ids.member }).expect(409);
});

test('HU-14/17: listado y detalle por rol, profesor con agenda general y socio solo oferta activa', async () => {
  const scheduled = await createClass(4);
  const cancelled = await createClass(3, future(48));
  await prisma.class.update({ where: { id: cancelled.id }, data: { cancelled: true } });
  for (const role of ['admin', 'professor'] as const) {
    const result = await request(app).get('/api/v1/classes').set(auth(role)).expect(200);
    assert.equal(result.body.meta.total, 2);
    await request(app).get(`/api/v1/classes/${cancelled.id}`).set(auth(role)).expect(200);
  }
  const memberList = await request(app).get('/api/v1/classes').set(auth('member')).expect(200);
  assert.deepEqual(memberList.body.data.map((row: { id: number }) => row.id), [scheduled.id]);
  assert.equal(memberList.body.data[0].availableSpots, 4);
  await request(app).get(`/api/v1/classes/${scheduled.id}`).set(auth('member')).expect(200);
  await request(app).get('/api/v1/classes').query({ professorId: ids.otherProfessor }).set(auth('professor')).expect(200);
});

test('HU-15: edita clase futura y limita cambios/capacidad con inscripciones', async () => {
  const klass = await createClass(3);
  const updatedStartsAt = new Date(klass.endsAt.getTime() - 30 * 60_000).toISOString();
  await request(app).patch(`/api/v1/classes/${klass.id}`).set(auth()).send({ capacity: 6, startsAt: updatedStartsAt }).expect(200);
  const type = await prisma.packageType.create({ data: { name: 'Paquete', classCredits: 4, durationDays: 30 } });
  const pack = await prisma.memberPackage.create({ data: { memberId: ids.member, packageTypeId: type.id, startsOn: new Date(), expiresOn: new Date(Date.now() + 30 * 86400000), initialCredits: 4, remainingCredits: 3 } });
  await prisma.enrollment.create({ data: { classId: klass.id, memberId: ids.member, memberPackageId: pack.id } });
  const secondMember = await prisma.user.create({ data: { name: 'Segundo socio', email: 'segundo@classes.test', role: 'MEMBER', passwordHash: await hashPassword(randomBytes(24).toString('hex')) } });
  const secondPack = await prisma.memberPackage.create({ data: { memberId: secondMember.id, packageTypeId: type.id, startsOn: new Date(), expiresOn: new Date(Date.now() + 30 * 86400000), initialCredits: 4, remainingCredits: 4 } });
  await prisma.enrollment.create({ data: { classId: klass.id, memberId: secondMember.id, memberPackageId: secondPack.id } });
  assert.equal(await prisma.enrollment.count({ where: { classId: klass.id, cancelled: false } }), 2);
  const alternativeActivity = await prisma.activity.create({ data: { name: 'Pilates' } });
  await request(app).patch(`/api/v1/classes/${klass.id}`).set(auth()).send({ capacity: 1 }).expect(409).expect(({ body }) => assert.equal(body.error.code, 'CAPACITY_BELOW_ENROLLMENTS'));
  await request(app).patch(`/api/v1/classes/${klass.id}`).set(auth()).send({ activityId: alternativeActivity.id }).expect(409).expect(({ body }) => assert.equal(body.error.code, 'CLASS_HAS_ENROLLMENTS'));
  await request(app).patch(`/api/v1/classes/${klass.id}`).set(auth('member')).send({ capacity: 7 }).expect(403);
  await request(app).patch(`/api/v1/classes/${klass.id}`).set(auth()).send({ capacity: 1 }).expect(409);
});

test('HU-16: cancelar conserva clase, cancela reservas, reintegra exactamente y rechaza repetición/roles ajenos', async () => {
  const klass = await createClass();
  const type = await prisma.packageType.create({ data: { name: 'Paquete', classCredits: 4, durationDays: 30 } });
  const pack = await prisma.memberPackage.create({ data: { memberId: ids.member, packageTypeId: type.id, startsOn: new Date(), expiresOn: new Date(Date.now() + 30 * 86400000), initialCredits: 4, remainingCredits: 2 } });
  const enrollment = await prisma.enrollment.create({ data: { classId: klass.id, memberId: ids.member, memberPackageId: pack.id } });
  await request(app).post(`/api/v1/classes/${klass.id}/cancel`).set(auth('member')).send({}).expect(403);
  const result = await request(app).post(`/api/v1/classes/${klass.id}/cancel`).set(auth()).send({}).expect(200);
  assert.equal(result.body.data.refundedCredits, 1);
  assert.equal((await prisma.class.findUniqueOrThrow({ where: { id: klass.id } })).cancelled, true);
  assert.deepEqual(await prisma.enrollment.findUniqueOrThrow({ where: { id: enrollment.id }, select: { cancelled: true, creditRefunded: true } }), { cancelled: true, creditRefunded: true });
  assert.equal((await prisma.memberPackage.findUniqueOrThrow({ where: { id: pack.id } })).remainingCredits, 3);
  await request(app).post(`/api/v1/classes/${klass.id}/cancel`).set(auth()).send({}).expect(409);
  assert.equal((await prisma.memberPackage.findUniqueOrThrow({ where: { id: pack.id } })).remainingCredits, 3);
});
