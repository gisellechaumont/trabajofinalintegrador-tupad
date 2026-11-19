import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors.js';
import { addCalendarDays, toDatabaseDate } from './member-packages.dates.js';
import type { MemberPackagesQuery, PackageStatus } from './member-packages.validation.js';

const memberPackageInclude = {
  member: { select: { id: true, name: true } },
  packageType: { select: { id: true, name: true } },
} satisfies Prisma.MemberPackageInclude;

export type MemberPackageRecord = Prisma.MemberPackageGetPayload<{ include: typeof memberPackageInclude }>;

export interface AssignmentReferences {
  member: { id: number; name: string; role: string; active: boolean } | null;
  packageType: { id: number; name: string; classCredits: number; durationDays: number; active: boolean } | null;
}

export interface MemberPackageSnapshots {
  memberId: number;
  packageTypeId: number;
  startsOn: Date;
  expiresOn: Date;
  initialCredits: number;
  remainingCredits: number;
}

function assignmentNameConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;

  const meta = error.meta;
  if (meta?.modelName !== 'MemberPackage') return false;
  const adapterError = meta.driverAdapterError;
  if (!adapterError || typeof adapterError !== 'object') return false;
  const cause = (adapterError as { cause?: unknown }).cause;
  if (!cause || typeof cause !== 'object') return false;

  const violation = cause as { kind?: unknown; table?: unknown; constraint?: unknown };
  const constraint = violation.constraint;
  return violation.kind === 'UniqueConstraintViolation'
    && violation.table === 'member_packages'
    && constraint !== null
    && typeof constraint === 'object'
    && (constraint as { index?: unknown }).index === 'member_packages_unique_assignment';
}

function rethrowAssignmentConflict(error: unknown): never {
  if (assignmentNameConflict(error)) {
    throw new AppError(409, 'PACKAGE_ASSIGNMENT_EXISTS', 'El socio ya tiene ese tipo de paquete con la misma fecha de inicio.');
  }
  throw error;
}

function statusWhere(status: PackageStatus, today: Date): Prisma.MemberPackageWhereInput {
  switch (status) {
    case 'NOT_STARTED':
      return { startsOn: { gt: today } };
    case 'EXPIRED':
      return { expiresOn: { lt: today } };
    case 'EXHAUSTED':
      return { startsOn: { lte: today }, expiresOn: { gte: today }, remainingCredits: 0 };
    case 'ACTIVE':
      return { startsOn: { lte: today }, expiresOn: { gte: today }, remainingCredits: { gt: 0 } };
  }
}

function expiringSoonWhere(today: Date, lastExpiringDay: Date): Prisma.MemberPackageWhereInput {
  return {
    startsOn: { lte: today },
    expiresOn: { gte: today, lte: lastExpiringDay },
    remainingCredits: { gt: 0 },
  };
}

export async function insertMemberPackage(
  memberId: number,
  packageTypeId: number,
  prepareSnapshots: (references: AssignmentReferences) => MemberPackageSnapshots,
): Promise<MemberPackageRecord> {
  try {
    return await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw<Array<{ id: number }>>`SELECT id FROM users WHERE id = ${memberId} FOR UPDATE`;
      await transaction.$queryRaw<Array<{ id: number }>>`SELECT id FROM package_types WHERE id = ${packageTypeId} FOR UPDATE`;

      const [member, packageType] = await Promise.all([
        transaction.user.findUnique({ where: { id: memberId }, select: { id: true, name: true, role: true, active: true } }),
        transaction.packageType.findUnique({ where: { id: packageTypeId }, select: { id: true, name: true, classCredits: true, durationDays: true, active: true } }),
      ]);
      const snapshots = prepareSnapshots({ member, packageType });

      return transaction.memberPackage.create({ data: snapshots, include: memberPackageInclude });
    });
  } catch (error) {
    return rethrowAssignmentConflict(error);
  }
}

export async function listMemberPackages(query: MemberPackagesQuery, todayKey: string) {
  const today = toDatabaseDate(todayKey);
  const lastExpiringDay = toDatabaseDate(addCalendarDays(todayKey, 7));
  const conditions: Prisma.MemberPackageWhereInput[] = [];

  if (query.memberId !== undefined) conditions.push({ memberId: query.memberId });
  if (query.status !== undefined) conditions.push(statusWhere(query.status, today));
  if (query.expiringSoon === true) conditions.push(expiringSoonWhere(today, lastExpiringDay));
  if (query.expiringSoon === false) conditions.push({ NOT: expiringSoonWhere(today, lastExpiringDay) });

  const where: Prisma.MemberPackageWhereInput = conditions.length > 0 ? { AND: conditions } : {};
  const [data, total] = await prisma.$transaction([
    prisma.memberPackage.findMany({
      where,
      include: memberPackageInclude,
      orderBy: [{ expiresOn: 'asc' }, { assignedAt: 'asc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.memberPackage.count({ where }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });

  return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
}

export function findMemberPackage(id: number) {
  return prisma.memberPackage.findUnique({ where: { id }, include: memberPackageInclude });
}
