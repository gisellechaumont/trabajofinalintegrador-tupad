import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors.js';
import type { CreatePackageTypeInput, PackageTypesQuery, PatchPackageTypeInput } from './package-types.validation.js';

function isPackageTypeNameConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;

  const meta = error.meta;
  if (meta?.modelName !== 'PackageType') return false;

  const adapterError = meta.driverAdapterError;
  if (!adapterError || typeof adapterError !== 'object') return false;

  const cause = (adapterError as { cause?: unknown }).cause;
  if (!cause || typeof cause !== 'object') return false;

  const uniqueViolation = cause as {
    kind?: unknown;
    table?: unknown;
    constraint?: unknown;
  };
  const constraint = uniqueViolation.constraint;

  return uniqueViolation.kind === 'UniqueConstraintViolation'
    && uniqueViolation.table === 'package_types'
    && constraint !== null
    && typeof constraint === 'object'
    && (constraint as { index?: unknown }).index === 'package_types_name_unique';
}

function rethrowPackageTypeNameConflict(error: unknown): never {
  if (isPackageTypeNameConflict(error)) {
    throw new AppError(409, 'PACKAGE_TYPE_NAME_CONFLICT', 'Ya existe un tipo de paquete con ese nombre.');
  }
  throw error;
}

export async function listPackageTypes(query: PackageTypesQuery) {
  const where: Prisma.PackageTypeWhereInput = {
    ...(query.active !== undefined ? { active: query.active } : {}),
    ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
  };
  const [data, total] = await prisma.$transaction([
    prisma.packageType.findMany({
      where,
      orderBy: { id: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.packageType.count({ where }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });

  return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
}

export function findPackageType(id: number) {
  return prisma.packageType.findUnique({ where: { id } });
}

export async function insertPackageType(data: CreatePackageTypeInput) {
  try {
    return await prisma.packageType.create({ data: { ...data, name: data.name.trim() } });
  } catch (error) {
    return rethrowPackageTypeNameConflict(error);
  }
}

export async function updatePackageType(id: number, data: PatchPackageTypeInput) {
  try {
    return await prisma.packageType.update({
      where: { id },
      data: { ...data, ...(data.name !== undefined ? { name: data.name.trim() } : {}) },
    });
  } catch (error) {
    return rethrowPackageTypeNameConflict(error);
  }
}
