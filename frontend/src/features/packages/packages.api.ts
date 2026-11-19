import type { ApiData, ApiPage, HttpClient, User } from '../../shared/types/api';
import type {
  MemberPackage,
  MemberPackageCreateInput,
  MemberPackagesQuery,
  PackageType,
  PackageTypeCreateInput,
  PackageTypePatchInput,
  PackageTypesQuery,
} from './packages.types';

function queryString(values: object) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

const CATALOG_PAGE_SIZE = 100;

async function fetchAllPages<T extends { id: number }>(api: HttpClient, path: string, filters: Record<string, string | boolean>) {
  const pageUrl = (page: number) => `${path}${queryString({ ...filters, page, pageSize: CATALOG_PAGE_SIZE })}`;
  const first = await api.request<ApiPage<T>>(pageUrl(1));
  const pageCount = Math.ceil(first.meta.total / first.meta.pageSize);
  const rest = await Promise.all(Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
    api.request<ApiPage<T>>(pageUrl(index + 2)),
  ));
  const unique = new Map<number, T>();
  for (const item of [...first.data, ...rest.flatMap((page) => page.data)]) unique.set(item.id, item);
  return [...unique.values()];
}

export function fetchAllActivePackageTypes(api: HttpClient) {
  return fetchAllPages<PackageType>(api, '/package-types', { active: true });
}

export function fetchAllActiveMembers(api: HttpClient) {
  return fetchAllPages<User>(api, '/users', { role: 'MEMBER', active: true });
}

export function fetchAllMembers(api: HttpClient) {
  return fetchAllPages<User>(api, '/users', { role: 'MEMBER' });
}

export function listPackageTypes(api: HttpClient, query: PackageTypesQuery = {}) {
  return api.request<ApiPage<PackageType>>(`/package-types${queryString(query)}`);
}

export function getPackageType(api: HttpClient, id: number | string) {
  return api.request<ApiData<PackageType>>(`/package-types/${id}`);
}

export function createPackageType(api: HttpClient, input: PackageTypeCreateInput) {
  return api.request<ApiData<PackageType>>('/package-types', { method: 'POST', body: input });
}

export function updatePackageType(api: HttpClient, id: number | string, input: PackageTypePatchInput) {
  return api.request<ApiData<PackageType>>(`/package-types/${id}`, { method: 'PATCH', body: input });
}

export function listMemberPackages(api: HttpClient, query: MemberPackagesQuery = {}) {
  return api.request<ApiPage<MemberPackage>>(`/member-packages${queryString(query)}`);
}

export function getMemberPackage(api: HttpClient, id: number | string) {
  return api.request<ApiData<MemberPackage>>(`/member-packages/${id}`);
}

export function createMemberPackage(api: HttpClient, input: MemberPackageCreateInput) {
  return api.request<ApiData<MemberPackage>>('/member-packages', { method: 'POST', body: input });
}
