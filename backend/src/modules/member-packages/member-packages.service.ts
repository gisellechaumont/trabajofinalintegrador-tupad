import { AppError } from '../../shared/errors.js';
import type { Identity } from '../../shared/types.js';
import * as repository from './member-packages.repository.js';
import { addCalendarDays, businessDateKey, derivePackageState, fromDatabaseDate, toDatabaseDate } from './member-packages.dates.js';
import type { CreateMemberPackageInput, MemberPackagesQuery } from './member-packages.validation.js';

function toMemberPackageView(row: repository.MemberPackageRecord, today: string) {
  const startsOn = fromDatabaseDate(row.startsOn);
  const expiresOn = fromDatabaseDate(row.expiresOn);
  const derived = derivePackageState({ startsOn, expiresOn, remainingCredits: row.remainingCredits }, today);

  return {
    id: row.id,
    member: row.member,
    packageType: row.packageType,
    startsOn,
    expiresOn,
    initialCredits: row.initialCredits,
    remainingCredits: row.remainingCredits,
    assignedAt: row.assignedAt.toISOString(),
    status: derived.status,
    expiringSoon: derived.expiringSoon,
  };
}

export async function assignMemberPackage(input: CreateMemberPackageInput) {
  const row = await repository.insertMemberPackage(input.memberId, input.packageTypeId, ({ member, packageType }) => {
    if (!member) throw new AppError(404, 'MEMBER_NOT_FOUND', 'No se encontró el socio.');
    if (member.role !== 'MEMBER') throw new AppError(409, 'INVALID_MEMBER', 'El usuario seleccionado no es socio.');
    if (!member.active) throw new AppError(409, 'INACTIVE_USER', 'El socio seleccionado está inactivo.');
    if (!packageType) throw new AppError(404, 'PACKAGE_TYPE_NOT_FOUND', 'No se encontró el tipo de paquete.');
    if (!packageType.active) throw new AppError(409, 'INACTIVE_PACKAGE_TYPE', 'El tipo de paquete está inactivo.');

    const expiresOn = addCalendarDays(input.startsOn, packageType.durationDays - 1);
    return {
      memberId: member.id,
      packageTypeId: packageType.id,
      startsOn: toDatabaseDate(input.startsOn),
      expiresOn: toDatabaseDate(expiresOn),
      initialCredits: packageType.classCredits,
      remainingCredits: packageType.classCredits,
    };
  });

  return { data: toMemberPackageView(row, businessDateKey()) };
}

export async function listMemberPackages(query: MemberPackagesQuery, identity: Identity) {
  const scopedQuery = identity.role === 'MEMBER' ? { ...query, memberId: identity.id } : query;
  const today = businessDateKey();
  const result = await repository.listMemberPackages(scopedQuery, today);
  return { ...result, data: result.data.map((row) => toMemberPackageView(row, today)) };
}

export async function getMemberPackage(id: number, identity: Identity) {
  const row = await repository.findMemberPackage(id);
  if (!row) throw new AppError(404, 'NOT_FOUND', 'No se encontró la asignación de paquete.');
  if (identity.role === 'MEMBER' && row.memberId !== identity.id) {
    throw new AppError(403, 'FORBIDDEN', 'No tenés permisos para consultar esta asignación.');
  }

  return { data: toMemberPackageView(row, businessDateKey()) };
}
