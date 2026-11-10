import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { SignJWT } from 'jose';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { env } from '../src/config/env.js';
import { createToken } from '../src/shared/token.js';
import { hashPassword, verifyPassword } from '../src/shared/password.js';
import { seedDatabase } from '../prisma/seed.js';

if (env.NODE_ENV !== 'test' || new URL(env.DATABASE_URL).pathname !== '/gymflow_test') throw new Error('Se requiere la base desechable gymflow_test.');
const app = createApp();
const password = randomBytes(24).toString('hex');
let passwordHash: string;
let ids: { admin: number; member: number; professor: number; inactive: number };
let tokens: { admin: string; member: string; professor: string };
const auth = (role: keyof typeof tokens = 'admin') => ({ Authorization: `Bearer ${tokens[role]}` });

before(async () => { await prisma.$connect(); passwordHash = await hashPassword(password); });
beforeEach(async () => {
  // Solo fixtures de gymflow_test, comprobado arriba. Nunca se usa gymflow.
  await prisma.$transaction([
    prisma.enrollment.deleteMany(), prisma.memberPackage.deleteMany(), prisma.class.deleteMany(),
    prisma.packageType.deleteMany(), prisma.activity.deleteMany(), prisma.user.deleteMany(),
  ]);
  const admin = await prisma.user.create({ data: { name: 'Admin Prueba', email: 'admin@gymflow.test', role: 'ADMIN', passwordHash } });
  const member = await prisma.user.create({ data: { name: 'Socio Prueba', email: 'member@gymflow.test', role: 'MEMBER', passwordHash } });
  const professor = await prisma.user.create({ data: { name: 'Profesor Prueba', email: 'professor@gymflow.test', role: 'PROFESSOR', passwordHash } });
  const inactive = await prisma.user.create({ data: { name: 'Socio Inactivo', email: 'inactive@gymflow.test', role: 'MEMBER', passwordHash, active: false } });
  ids = { admin: admin.id, member: member.id, professor: professor.id, inactive: inactive.id };
  tokens = { admin: await createToken(admin.id), member: await createToken(member.id), professor: await createToken(professor.id) };
});
after(async () => { await prisma.$disconnect(); });

test('health y headers básicos sin exponer tecnología', async () => {
  const res = await request(app).get('/health').expect(200);
  assert.equal(res.body.status, 'ok'); assert.equal(res.headers['x-powered-by'], undefined);
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
});
test('login devuelve JWT, duración y solo datos públicos', async () => {
  const res = await request(app).post('/api/v1/auth/login').send({ email: ' ADMIN@GYMFLOW.TEST ', password }).expect(200);
  assert.equal(res.body.data.user.id, ids.admin); assert.equal(res.body.data.expiresIn, 3600); assert.equal(res.body.data.tokenType, 'Bearer');
  assert.deepEqual(Object.keys(res.body.data.user).sort(), ['active', 'email', 'id', 'name', 'role']);
  await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${res.body.data.accessToken}`).expect(200);
  assert.equal(res.headers['cache-control'], 'no-store');
});
test('login incorrecto, inexistente e inactivo devuelven el mismo error', async () => {
  const bodies = [];
  for (const input of [{ email: 'missing@gymflow.test', password }, { email: 'member@gymflow.test', password: 'incorrecta' }, { email: 'inactive@gymflow.test', password }]) bodies.push((await request(app).post('/api/v1/auth/login').send(input).expect(401)).body);
  assert.deepEqual(bodies[0], bodies[1]); assert.deepEqual(bodies[1], bodies[2]);
});
test('valida login y rechaza campos extra', async () => {
  await request(app).post('/api/v1/auth/login').send({ email: 'no-es-correo', password }).expect(422);
  await request(app).post('/api/v1/auth/login').send({ email: 'admin@gymflow.test', password, role: 'ADMIN' }).expect(422);
});
test('rechaza acceso sin token, mal formado, vencido o de otro emisor', async () => {
  await request(app).get('/api/v1/users').expect(401);
  await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer abc').expect(401);
  for (const expired of [true, false]) {
    const token = await new SignJWT({}).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setSubject(String(ids.admin)).setIssuedAt().setExpirationTime(expired ? '0s' : '1h').setIssuer(expired ? env.JWT_ISSUER : 'otro').setAudience(env.JWT_AUDIENCE).sign(new TextEncoder().encode(env.JWT_SECRET));
    await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
  }
});
test('rol del JWT no reemplaza el rol actual de la base', async () => {
  const token = await new SignJWT({ role: 'ADMIN' }).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setSubject(String(ids.member)).setIssuedAt().setExpirationTime('1h').setIssuer(env.JWT_ISSUER).setAudience(env.JWT_AUDIENCE).sign(new TextEncoder().encode(env.JWT_SECRET));
  await request(app).get('/api/v1/users').set('Authorization', `Bearer ${token}`).expect(403);
});
test('socios y profesores no administran usuarios ni actividades', async () => {
  for (const role of ['member', 'professor'] as const) {
    await request(app).get('/api/v1/users').set(auth(role)).expect(403);
    await request(app).patch(`/api/v1/users/${ids.member}`).set(auth(role)).send({ active: false }).expect(403);
    await request(app).post('/api/v1/activities').set(auth(role)).send({ name: 'Nueva' }).expect(403);
  }
});
test('crea socio/profesor, normaliza email y guarda Argon2id', async () => {
  for (const role of ['MEMBER', 'PROFESSOR']) {
    const email = `nueva.${role.toLowerCase()}@gymflow.test`;
    const res = await request(app).post('/api/v1/users').set(auth()).send({ name: ' Persona Nueva ', email: ` ${email.toUpperCase()} `, password, role }).expect(201);
    assert.equal(res.body.data.name, 'Persona Nueva'); assert.equal(res.body.data.email, email);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: res.body.data.id } });
    assert.ok(row.passwordHash.startsWith('$argon2id$')); assert.equal(await verifyPassword(row.passwordHash, password), true); assert.equal(res.body.data.passwordHash, undefined);
  }
});
test('altas concurrentes con el mismo correo producen 201 y 409', async () => {
  const input = { name: 'Duplicado', email: 'duplicado@gymflow.test', password, role: 'MEMBER' };
  const results = await Promise.all([request(app).post('/api/v1/users').set(auth()).send(input), request(app).post('/api/v1/users').set(auth()).send({ ...input, email: ' DUPLICADO@GYMFLOW.TEST ' })]);
  assert.deepEqual(results.map((res) => res.status).sort(), [201, 409]); assert.equal(results.find((res) => res.status === 409)?.body.error.code, 'EMAIL_IN_USE');
});
test('no crea ADMIN ni admite datos inválidos o inesperados', async () => {
  const valid = { name: 'Cuenta', email: 'nueva@gymflow.test', password, role: 'MEMBER' };
  for (const change of [{ role: 'ADMIN' }, { password: 'corta' }, { name: ' ' }, { email: 'mal' }, { active: false }, { id: ids.admin }]) await request(app).post('/api/v1/users').set(auth()).send({ ...valid, ...change }).expect(422);
});
test('paginación, rol, búsqueda y active=false funcionan', async () => {
  const inactive = await request(app).get('/api/v1/users?role=MEMBER&active=false&page=1&pageSize=1').set(auth()).expect(200);
  assert.equal(inactive.body.data[0].id, ids.inactive); assert.equal(inactive.body.meta.total, 1);
  const found = await request(app).get('/api/v1/users?search=PROFESOR').set(auth()).expect(200);
  assert.equal(found.body.data.length, 1); assert.equal(found.body.data[0].role, 'PROFESSOR');
  const all = await request(app).get('/api/v1/users').set(auth()).expect(200);
  assert.equal(all.body.data.some((user: { role: string }) => user.role === 'ADMIN'), false);
});
test('filtros e ids inválidos devuelven 400; texto SQL se trata como texto', async () => {
  for (const query of ['page=0', 'pageSize=101', 'active=FALSE', 'role=ADMIN', 'page=1&page=2', 'otro=1']) await request(app).get(`/api/v1/users?${query}`).set(auth()).expect(400);
  for (const id of ['-1', '0', '1e3', 'abc', '2147483648']) await request(app).get(`/api/v1/users/${id}`).set(auth()).expect(400);
  const res = await request(app).get('/api/v1/users').query({ search: "' OR 1=1 --" }).set(auth()).expect(200); assert.equal(res.body.data.length, 0);
});
test('detalle distingue inexistente y cuenta administrativa no gestionable', async () => {
  await request(app).get('/api/v1/users/2147483647').set(auth()).expect(404);
  await request(app).get(`/api/v1/users/${ids.admin}`).set(auth()).expect(403);
});
test('edita datos sin cambiar rol/contraseña; detecta duplicados', async () => {
  const res = await request(app).patch(`/api/v1/users/${ids.member}`).set(auth()).send({ name: 'Nombre Editado', email: ' EDITADO@GYMFLOW.TEST ' }).expect(200);
  assert.equal(res.body.data.email, 'editado@gymflow.test'); assert.equal(res.body.data.role, 'MEMBER');
  for (const input of [{ role: 'ADMIN' }, { password }, {}]) await request(app).patch(`/api/v1/users/${ids.member}`).set(auth()).send(input).expect(422);
  await request(app).patch(`/api/v1/users/${ids.member}`).set(auth()).send({ email: 'professor@gymflow.test' }).expect(409);
});
test('desactivar conserva historial e invalida acceso; reactivar conserva la cuenta', async () => {
  const activity = await prisma.activity.create({ data: { name: 'Yoga' } });
  const klass = await prisma.class.create({ data: { activityId: activity.id, professorId: ids.professor, startsAt: new Date('2035-01-01T15:00:00Z'), endsAt: new Date('2035-01-01T16:00:00Z'), capacity: 5 } });
  const type = await prisma.packageType.create({ data: { name: 'Paquete', classCredits: 4, durationDays: 30 } });
  const pack = await prisma.memberPackage.create({ data: { memberId: ids.member, packageTypeId: type.id, startsOn: new Date('2035-01-01'), expiresOn: new Date('2035-01-30'), initialCredits: 4, remainingCredits: 3 } });
  const enrollment = await prisma.enrollment.create({ data: { classId: klass.id, memberId: ids.member, memberPackageId: pack.id } });
  await request(app).patch(`/api/v1/users/${ids.member}`).set(auth()).send({ active: false }).expect(200);
  await request(app).get('/api/v1/auth/me').set(auth('member')).expect(401);
  assert.equal(await prisma.enrollment.count({ where: { id: enrollment.id } }), 1); assert.equal(await prisma.memberPackage.count({ where: { id: pack.id } }), 1);
  const res = await request(app).patch(`/api/v1/users/${ids.member}`).set(auth()).send({ active: true }).expect(200);
  assert.equal(res.body.data.id, ids.member); await request(app).get('/api/v1/auth/me').set(auth('member')).expect(200);
});
test('perfil solo modifica la identidad autenticada', async () => {
  for (const input of [{ id: ids.admin, name: 'Intento' }, { active: false }, { role: 'ADMIN' }]) await request(app).patch('/api/v1/auth/profile').set(auth('member')).send(input).expect(422);
  const res = await request(app).patch('/api/v1/auth/profile').set(auth('member')).send({ name: 'Mi Nombre' }).expect(200);
  assert.equal(res.body.data.id, ids.member); assert.equal(res.body.data.name, 'Mi Nombre');
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: ids.admin } })).name, 'Admin Prueba');
  await request(app).patch('/api/v1/auth/profile').set(auth('member')).send({ email: 'admin@gymflow.test' }).expect(409);
});
test('cambio de contraseña exige la actual y permite login con la nueva', async () => {
  const newPassword = randomBytes(24).toString('hex');
  await request(app).put('/api/v1/auth/password').set(auth('member')).send({ currentPassword: 'incorrecta', newPassword }).expect(422);
  const res = await request(app).put('/api/v1/auth/password').set(auth('member')).send({ currentPassword: password, newPassword }).expect(204); assert.equal(res.text, '');
  await request(app).post('/api/v1/auth/login').send({ email: 'member@gymflow.test', password }).expect(401);
  await request(app).post('/api/v1/auth/login').send({ email: 'member@gymflow.test', password: newPassword }).expect(200);
  await request(app).get('/api/v1/auth/me').set(auth('member')).expect(200); // Sin revocación centralizada, según contrato.
});
test('actividades: alta, edición, nulos y unicidad por mayúsculas/espacios', async () => {
  const created = await request(app).post('/api/v1/activities').set(auth()).send({ name: ' Yoga ', description: 'Descripción' }).expect(201);
  assert.equal(created.body.data.name, 'Yoga');
  const dup = await request(app).post('/api/v1/activities').set(auth()).send({ name: ' YOGA ' }).expect(409); assert.equal(dup.body.error.code, 'NAME_IN_USE');
  const edited = await request(app).patch(`/api/v1/activities/${created.body.data.id}`).set(auth()).send({ name: 'Yoga suave', description: null }).expect(200); assert.equal(edited.body.data.description, null);
});
test('solo ADMIN ve inactivas; activar y desactivar no borra la actividad', async () => {
  const active = await prisma.activity.create({ data: { name: 'Activa' } }); const inactive = await prisma.activity.create({ data: { name: 'Inactiva', active: false } });
  for (const role of ['member', 'professor'] as const) {
    const res = await request(app).get('/api/v1/activities').set(auth(role)).expect(200); assert.deepEqual(res.body.data.map((row: { id: number }) => row.id), [active.id]);
    await request(app).get(`/api/v1/activities/${inactive.id}`).set(auth(role)).expect(403);
    await request(app).get('/api/v1/activities?active=false').set(auth(role)).expect(403);
  }
  const res = await request(app).get('/api/v1/activities?active=false').set(auth()).expect(200); assert.equal(res.body.data[0].id, inactive.id);
  await request(app).patch(`/api/v1/activities/${active.id}`).set(auth()).send({ active: false }).expect(200);
  assert.equal(await prisma.activity.count(), 2);
});
test('valida campos de actividades, filtros y referencias inexistentes', async () => {
  for (const input of [{ name: ' ' }, { name: 'A', extra: 1 }, { name: 'A'.repeat(101) }]) await request(app).post('/api/v1/activities').set(auth()).send(input).expect(422);
  await request(app).get('/api/v1/activities?active=0').set(auth()).expect(400);
  await request(app).patch('/api/v1/activities/2147483647').set(auth()).send({ active: false }).expect(404);
});
test('JSON roto y cuerpos enormes no revelan errores internos', async () => {
  const bad = await request(app).post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{"email":').expect(400); assert.equal(bad.body.error.code, 'INVALID_JSON');
  const large = await request(app).post('/api/v1/auth/login').send({ email: 'a@gymflow.test', password: 'x'.repeat(20_000) }).expect(413); assert.equal(large.body.error.code, 'REQUEST_TOO_LARGE'); assert.equal(large.body.stack, undefined);
});
test('CORS acepta el origen configurado y rechaza otro', async () => {
  const res = await request(app).options('/api/v1/users').set('Origin', env.CORS_ORIGIN).set('Access-Control-Request-Method', 'GET').expect(204); assert.equal(res.headers['access-control-allow-origin'], env.CORS_ORIGIN);
  const denied = await request(app).post('/api/v1/auth/login').set('Origin', 'https://ajeno.example').send({ email: 'admin@gymflow.test', password }).expect(403); assert.equal(denied.body.error.code, 'CORS_ORIGIN_DENIED');
});
test('limita diez intentos de login por minuto', async () => {
  const limited = createApp();
  for (let index = 0; index < 10; index++) await request(limited).post('/api/v1/auth/login').send({ email: 'missing@gymflow.test', password }).expect(401);
  const res = await request(limited).post('/api/v1/auth/login').send({ email: 'missing@gymflow.test', password }).expect(429); assert.equal(res.body.error.code, 'TOO_MANY_ATTEMPTS');
});
test('no agrega endpoints simulados ni borrados físicos', async () => {
  await request(app).get('/api/v1/classes').set(auth()).expect(404);
  await request(app).delete(`/api/v1/users/${ids.member}`).set(auth()).expect(404);
  assert.equal(await prisma.user.count({ where: { id: ids.member } }), 1);
});
test('seed repetible no reinicia estados, nombres o contraseñas', async () => {
  await seedDatabase(prisma, password);
  const user = await prisma.user.update({ where: { email: 'juan.member@gymflow.test' }, data: { name: 'Nombre Conservado', active: false } }); const count = await prisma.user.count();
  await seedDatabase(prisma, randomBytes(24).toString('hex'));
  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(row.name, 'Nombre Conservado'); assert.equal(row.active, false); assert.equal(row.passwordHash, user.passwordHash); assert.equal(await prisma.user.count(), count); assert.equal(await prisma.activity.count(), 3);
});
