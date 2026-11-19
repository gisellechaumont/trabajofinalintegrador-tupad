import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors.js';
import { businessDateKey, derivePackageState, fromDatabaseDate, toDatabaseDate } from '../member-packages/member-packages.dates.js';
import type { EnrollmentsQuery } from './enrollments.validation.js';

const enrollmentInclude = {
  member: { select: { id: true, name: true } },
  package: { include: { packageType: { select: { id: true, name: true } } } },
  class: { include: {
    activity: { select: { id: true, name: true } },
    professor: { select: { id: true, name: true } },
    _count: { select: { enrollments: { where: { cancelled: false } } } },
  } },
} satisfies Prisma.EnrollmentInclude;

type Tx = Prisma.TransactionClient;
type ClassForEnrollment = Prisma.ClassGetPayload<{ include: typeof enrollmentInclude.class.include }>;
const eligibilityPackageInclude = {
  member: { select: { id: true, name: true } },
  packageType: { select: { id: true, name: true } },
} satisfies Prisma.MemberPackageInclude;
type EligibilityPackage = Prisma.MemberPackageGetPayload<{ include: typeof eligibilityPackageInclude }>;

function enrollmentConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  const meta = error.meta;
  if (meta?.modelName !== 'Enrollment') return false;
  const adapter = meta.driverAdapterError;
  if (!adapter || typeof adapter !== 'object') return false;
  const cause = (adapter as { cause?: unknown }).cause;
  if (!cause || typeof cause !== 'object') return false;
  const violation = cause as { kind?: unknown; table?: unknown; constraint?: unknown };
  const constraint = violation.constraint;
  return violation.kind === 'UniqueConstraintViolation'
    && violation.table === 'class_reservations'
    && constraint !== null && typeof constraint === 'object'
    && (constraint as { index?: unknown }).index === 'reservations_one_active_per_member_class';
}

function isSerializableConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === 'P2034') return true;
  if (error.code !== 'P2010') return false;

  const adapter = error.meta?.driverAdapterError;
  if (!adapter || typeof adapter !== 'object') return false;
  const cause = (adapter as { cause?: unknown }).cause;
  if (!cause || typeof cause !== 'object') return false;
  const conflict = cause as { kind?: unknown; originalCode?: unknown };
  return conflict.kind === 'TransactionWriteConflict'
    && conflict.originalCode === '40001';
}

async function serializable<T>(operation: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (isSerializableConflict(error)) {
        if (attempt < 2) continue;
        throw new AppError(409, 'CONCURRENT_MODIFICATION', 'La inscripción fue modificada simultáneamente. Volvé a intentar la operación.');
      }
      if (enrollmentConflict(error)) throw new AppError(409, 'ALREADY_ENROLLED', 'El socio ya tiene una inscripción activa para esta clase.');
      throw error;
    }
  }
  throw new AppError(409, 'CONCURRENT_MODIFICATION', 'La inscripción fue modificada simultáneamente. Volvé a intentar la operación.');
}

async function lockClass(tx: Tx, id: number) { await tx.$queryRaw`SELECT id FROM classes WHERE id = ${id} FOR UPDATE`; }
async function lockMember(tx: Tx, id: number) { await tx.$queryRaw`SELECT id FROM users WHERE id = ${id} FOR UPDATE`; }
async function lockPackage(tx: Tx, id: number) { await tx.$queryRaw`SELECT id FROM member_packages WHERE id = ${id} FOR UPDATE`; }
async function lockEnrollment(tx: Tx, id: number) { await tx.$queryRaw`SELECT id FROM class_reservations WHERE id = ${id} FOR UPDATE`; }

export type Eligibility = {
  canEnroll: boolean;
  message: string;
  reason: 'CLASS_FULL' | 'CLASS_CANCELLED' | 'CLASS_STARTED' | 'ALREADY_ENROLLED' | 'NO_USABLE_PACKAGE' | null;
  reasonCode: 'CLASS_FULL' | 'CLASS_CANCELLED' | 'CLASS_STARTED' | 'ALREADY_ENROLLED' | 'NO_USABLE_PACKAGE' | null;
  memberPackageId: number | null;
  remainingCredits: number | null;
  remainingCreditsAfterEnrollment: number | null;
  selectedPackage: ReturnType<typeof eligibilityPackageView> | null;
  expectedRemainingCredits: number | null;
};

function eligibilityPackageView(row: EligibilityPackage, today: string) {
  const startsOn = fromDatabaseDate(row.startsOn);
  const expiresOn = fromDatabaseDate(row.expiresOn);
  const state = derivePackageState({ startsOn, expiresOn, remainingCredits: row.remainingCredits }, today);
  return {
    id: row.id, member: row.member, packageType: row.packageType, startsOn, expiresOn,
    initialCredits: row.initialCredits, remainingCredits: row.remainingCredits,
    assignedAt: row.assignedAt.toISOString(), status: state.status, expiringSoon: state.expiringSoon,
  };
}

async function loadReferences(memberId: number, classId: number) {
  const [member, klass] = await Promise.all([
    prisma.user.findUnique({ where: { id: memberId }, select: { id: true, role: true, active: true } }),
    prisma.class.findUnique({ where: { id: classId }, include: enrollmentInclude.class.include }),
  ]);
  return { member, klass };
}

function validateMember(member: { id: number; role: string; active: boolean } | null) {
  if (!member) throw new AppError(404, 'MEMBER_NOT_FOUND', 'No se encontró el socio.');
  if (member.role !== 'MEMBER') throw new AppError(409, 'INVALID_MEMBER', 'El usuario indicado no es socio.');
  if (!member.active) throw new AppError(409, 'INACTIVE_USER', 'El socio está inactivo.');
}

function validateClassExists(klass: ClassForEnrollment | null): asserts klass is ClassForEnrollment {
  if (!klass) throw new AppError(404, 'NOT_FOUND', 'No se encontró la clase.');
}

function classReason(klass: NonNullable<Awaited<ReturnType<typeof loadReferences>>['klass']>, now: Date) {
  if (klass.cancelled) return 'CLASS_CANCELLED' as const;
  if (klass.startsAt <= now) return 'CLASS_STARTED' as const;
  return null;
}

function classIsFull(klass: ClassForEnrollment) { return klass._count.enrollments >= klass.capacity; }

async function packageCandidates(memberId: number, classStart: Date, todayKey: string) {
  const today = toDatabaseDate(todayKey);
  const classDay = toDatabaseDate(businessDateKey(classStart));
  const requiredThrough = todayKey > businessDateKey(classStart) ? today : classDay;
  return prisma.memberPackage.findMany({
    where: { memberId, remainingCredits: { gt: 0 }, startsOn: { lte: requiredThrough }, expiresOn: { gte: requiredThrough } },
    orderBy: [{ expiresOn: 'asc' }, { assignedAt: 'asc' }, { id: 'asc' }],
    include: eligibilityPackageInclude,
  });
}

function unavailable(reason: NonNullable<Eligibility['reason']>, message: string): Eligibility {
  return { canEnroll: false, message, reason, reasonCode: reason, memberPackageId: null, remainingCredits: null, remainingCreditsAfterEnrollment: null, selectedPackage: null, expectedRemainingCredits: null };
}

export async function checkEligibility(memberId: number, classId: number, now = new Date()): Promise<Eligibility> {
  const { member, klass } = await loadReferences(memberId, classId);
  validateMember(member);
  validateClassExists(klass);
  const reason = classReason(klass, now);
  if (reason) return unavailable(reason, reason === 'CLASS_CANCELLED' ? 'La clase está cancelada.' : 'La clase ya comenzó.');
  const duplicate = await prisma.enrollment.findFirst({ where: { memberId, classId, cancelled: false }, select: { id: true } });
  if (duplicate) return unavailable('ALREADY_ENROLLED', 'El socio ya tiene una inscripción activa para esta clase.');
  if (classIsFull(klass)) return unavailable('CLASS_FULL', 'La clase no tiene cupos disponibles.');
  const candidates = await packageCandidates(memberId, klass.startsAt, businessDateKey(now));
  const selected = candidates[0];
  if (!selected) return unavailable('NO_USABLE_PACKAGE', 'El socio no tiene un paquete utilizable para esta clase.');
  return {
    canEnroll: true, message: 'El socio puede inscribirse.', reason: null, reasonCode: null,
    memberPackageId: selected.id,
    remainingCredits: selected.remainingCredits,
    remainingCreditsAfterEnrollment: selected.remainingCredits - 1,
    selectedPackage: eligibilityPackageView(selected, businessDateKey(now)),
    expectedRemainingCredits: selected.remainingCredits - 1,
  };
}

export async function createEnrollment(memberId: number, classId: number) {
  try {
    return await serializable(async (tx) => {
      await lockClass(tx, classId);
      const klass = await tx.class.findUnique({ where: { id: classId }, include: enrollmentInclude.class.include });
      validateClassExists(klass);
      const now = new Date();
      const reason = classReason(klass, now);
      if (reason === 'CLASS_CANCELLED') throw new AppError(409, reason, 'La clase está cancelada.');
      if (reason === 'CLASS_STARTED') throw new AppError(409, reason, 'La clase ya comenzó.');

      await lockMember(tx, memberId);
      const member = await tx.user.findUnique({ where: { id: memberId }, select: { id: true, role: true, active: true } });
      validateMember(member);

      const todayKey = businessDateKey(now);
      const today = toDatabaseDate(todayKey);
      const classDayKey = businessDateKey(klass.startsAt);
      const startsOnLimit = todayKey > classDayKey ? today : classDayKey > todayKey ? toDatabaseDate(classDayKey) : today;
      const expiresOnLimit = startsOnLimit;
      const candidates = await tx.memberPackage.findMany({
        where: { memberId, remainingCredits: { gt: 0 }, startsOn: { lte: startsOnLimit }, expiresOn: { gte: expiresOnLimit } },
        select: { id: true }, orderBy: { id: 'asc' },
      });
      const duplicate = await tx.enrollment.findFirst({ where: { memberId, classId, cancelled: false }, select: { id: true, memberPackageId: true } });
      const packageLocks = [...new Set([
        ...candidates.map(({ id }) => id),
        ...(duplicate ? [duplicate.memberPackageId] : []),
      ])].sort((a, b) => a - b);
      for (const packageId of packageLocks) await lockPackage(tx, packageId);
      if (duplicate) {
        await lockEnrollment(tx, duplicate.id);
        const existing = await tx.enrollment.findFirst({ where: { id: duplicate.id, cancelled: false }, select: { id: true } });
        if (existing) throw new AppError(409, 'ALREADY_ENROLLED', 'El socio ya tiene una inscripción activa para esta clase.');
      }
      if (classIsFull(klass)) throw new AppError(409, 'CLASS_FULL', 'La clase no tiene cupos disponibles.');
      const refreshed = candidates.length ? await tx.memberPackage.findMany({
        where: { id: { in: candidates.map(({ id }) => id) }, memberId, remainingCredits: { gt: 0 }, startsOn: { lte: startsOnLimit }, expiresOn: { gte: expiresOnLimit } },
        orderBy: [{ expiresOn: 'asc' }, { assignedAt: 'asc' }, { id: 'asc' }],
        include: eligibilityPackageInclude,
      }) : [];
      const selected = refreshed[0];
      if (!selected) throw new AppError(409, 'NO_USABLE_PACKAGE', 'El socio no tiene un paquete utilizable para esta clase.');

      const debit = await tx.memberPackage.updateMany({ where: { id: selected.id, memberId, remainingCredits: { gt: 0 } }, data: { remainingCredits: { decrement: 1 } } });
      if (debit.count !== 1) throw new AppError(409, 'NO_USABLE_PACKAGE', 'El paquete ya no tiene créditos disponibles.');
      return tx.enrollment.create({ data: { classId, memberId, memberPackageId: selected.id }, include: enrollmentInclude });
    });
  } catch (error) {
    if (enrollmentConflict(error)) throw new AppError(409, 'ALREADY_ENROLLED', 'El socio ya tiene una inscripción activa para esta clase.');
    throw error;
  }
}

export async function cancelEnrollment(id: number, requesterId: number, isAdmin: boolean, now = new Date()) {
  const relation = await prisma.enrollment.findUnique({ where: { id }, select: { id: true, classId: true, memberId: true, memberPackageId: true } });
  if (!relation) throw new AppError(404, 'NOT_FOUND', 'No se encontró la inscripción.');
  if (!isAdmin && relation.memberId !== requesterId) throw new AppError(403, 'FORBIDDEN', 'No tenés permisos para cancelar esta inscripción.');
  return serializable(async (tx) => {
    await lockClass(tx, relation.classId);
    await lockMember(tx, relation.memberId);
    await lockPackage(tx, relation.memberPackageId);
    await lockEnrollment(tx, id);
    const row = await tx.enrollment.findUnique({ where: { id }, include: enrollmentInclude });
    if (!row) throw new AppError(404, 'NOT_FOUND', 'No se encontró la inscripción.');
    if (!isAdmin && row.memberId !== requesterId) throw new AppError(403, 'FORBIDDEN', 'No tenés permisos para cancelar esta inscripción.');
    if (row.cancelled) throw new AppError(409, 'ALREADY_CANCELLED', 'La inscripción ya está cancelada.');
    if (now.getTime() > row.class.startsAt.getTime() - 2 * 60 * 60 * 1000) {
      throw new AppError(409, 'CANCELLATION_WINDOW_CLOSED', 'La inscripción solo puede cancelarse hasta dos horas antes del comienzo.');
    }
    const cancelledAt = now;
    const updated = await tx.enrollment.update({ where: { id }, data: { cancelled: true, cancelledAt, creditRefunded: true }, include: enrollmentInclude });
    await tx.memberPackage.update({ where: { id: row.memberPackageId }, data: { remainingCredits: { increment: 1 } } });
    return updated;
  });
}

export async function listEnrollments(query: EnrollmentsQuery, scopedMemberId?: number) {
  const memberId = scopedMemberId ?? query.memberId;
  const classWhere: Prisma.ClassWhereInput = {
    ...(query.from || query.to ? { startsAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lt: new Date(query.to) } : {}) } } : {}),
  };
  const where: Prisma.EnrollmentWhereInput = {
    ...(memberId !== undefined ? { memberId } : {}),
    ...(query.classId !== undefined ? { classId: query.classId } : {}),
    ...(query.cancelled !== undefined ? { cancelled: query.cancelled } : {}),
    ...(Object.keys(classWhere).length ? { class: classWhere } : {}),
  };
  const [data, total] = await prisma.$transaction([
    prisma.enrollment.findMany({ where, include: enrollmentInclude, orderBy: [{ class: { startsAt: 'asc' } }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.enrollment.count({ where }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
}

export function findEnrollment(id: number) { return prisma.enrollment.findUnique({ where: { id }, include: enrollmentInclude }); }
