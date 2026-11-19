export type PackageStatus = 'NOT_STARTED' | 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED';
export const packageStatusLabels: Record<PackageStatus, string> = {
  NOT_STARTED: 'Pendiente de inicio',
  ACTIVE: 'Activo',
  EXHAUSTED: 'Sin créditos',
  EXPIRED: 'Vencido',
};

export interface PackageType {
  id: number;
  name: string;
  classCredits: number;
  durationDays: number;
  active: boolean;
}

export interface PackagePerson {
  id: number;
  name: string;
}

export interface MemberPackage {
  id: number;
  member: PackagePerson;
  packageType: PackagePerson;
  startsOn: string;
  expiresOn: string;
  initialCredits: number;
  remainingCredits: number;
  assignedAt: string;
  status: PackageStatus;
  expiringSoon: boolean;
}

export interface PackageTypeCreateInput {
  name: string;
  classCredits: number;
  durationDays: number;
}

export type PackageTypePatchInput = Partial<PackageTypeCreateInput> & { active?: boolean };

export interface MemberPackageCreateInput {
  memberId: number;
  packageTypeId: number;
  startsOn: string;
}

export interface PackageTypesQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  active?: boolean;
}

export interface MemberPackagesQuery {
  page?: number;
  pageSize?: number;
  memberId?: number;
  status?: PackageStatus;
  expiringSoon?: boolean;
}
