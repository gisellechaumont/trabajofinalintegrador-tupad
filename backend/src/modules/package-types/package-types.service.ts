import { AppError } from '../../shared/errors.js';
import * as repository from './package-types.repository.js';
import type { PackageTypesQuery, PatchPackageTypeInput } from './package-types.validation.js';

export function listPackageTypes(query: PackageTypesQuery) {
  return repository.listPackageTypes(query);
}

export async function getPackageType(id: number) {
  const packageType = await repository.findPackageType(id);
  if (!packageType) {
    throw new AppError(404, 'PACKAGE_TYPE_NOT_FOUND', 'No se encontró el tipo de paquete.');
  }
  return packageType;
}

export async function patchPackageType(id: number, data: PatchPackageTypeInput) {
  await getPackageType(id);
  return repository.updatePackageType(id, data);
}
