import type {
  ApiData,
  ApiPage,
  HttpClient,
} from '../../shared/types/api';
import type {
  ClassCancellation,
  ClassBatchCreateInput,
  ClassCreateInput,
  ClassesQuery,
  ClassPatchInput,
  ClassView,
  ClassOption,
} from './classes.types';

const CATALOG_PAGE_SIZE = 100;

function catalogPageUrl(path: string, query: string, page: number) {
  const params = new URLSearchParams(query);
  params.set('page', String(page));
  params.set('pageSize', String(CATALOG_PAGE_SIZE));
  return `${path}?${params.toString()}`;
}

async function fetchAllPages<T extends { id: number }>(api: HttpClient, path: string, query: string): Promise<T[]> {
  const first = await api.request<ApiPage<T>>(catalogPageUrl(path, query, 1));
  const pageCount = Math.ceil(first.meta.total / first.meta.pageSize);
  const rest = await Promise.all(Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
    api.request<ApiPage<T>>(catalogPageUrl(path, query, index + 2)),
  ));
  const unique = new Map<number, T>();
  for (const item of [...first.data, ...rest.flatMap((page) => page.data)]) unique.set(item.id, item);
  return [...unique.values()];
}

export function fetchActiveClassActivities(api: HttpClient) {
  return fetchAllPages<ClassOption>(api, '/activities', 'active=true');
}

export function fetchClassActivityOptions(api: HttpClient) {
  return fetchAllPages<ClassOption>(api, '/activities', '');
}

export function fetchActiveClassProfessors(api: HttpClient) {
  return fetchAllPages<ClassOption>(api, '/users', 'role=PROFESSOR&active=true');
}

export function fetchClassProfessorCatalog(api: HttpClient) {
  return fetchAllPages<ClassOption>(api, '/users', 'role=PROFESSOR');
}

export async function fetchClassProfessorOptions(api: HttpClient) {
  const first = await api.request<ApiPage<ClassView>>('/classes?page=1&pageSize=100');
  const pageCount = Math.ceil(first.meta.total / first.meta.pageSize);
  const rest = await Promise.all(Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
    api.request<ApiPage<ClassView>>(`/classes?page=${index + 2}&pageSize=100`),
  ));
  const unique = new Map<number, ClassOption>();
  for (const gymClass of [...first.data, ...rest.flatMap((page) => page.data)]) unique.set(gymClass.professor.id, gymClass.professor);
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

function classesQueryString(
  query: ClassesQuery,
) {
  const params = new URLSearchParams();

  if (query.page !== undefined) {
    params.set('page', String(query.page));
  }

  if (query.pageSize !== undefined) {
    params.set(
      'pageSize',
      String(query.pageSize),
    );
  }

  if (query.from) {
    params.set('from', query.from);
  }

  if (query.to) {
    params.set('to', query.to);
  }

  if (query.activityId !== undefined) {
    params.set(
      'activityId',
      String(query.activityId),
    );
  }

  if (query.professorId !== undefined) {
    params.set(
      'professorId',
      String(query.professorId),
    );
  }

  if (query.status) {
    params.set('status', query.status);
  }

  const value = params.toString();

  return value
    ? `?${value}`
    : '';
}

export function fetchClasses(
  api: HttpClient,
  query: ClassesQuery = {},
) {
  return api.request<ApiPage<ClassView>>(
    `/classes${classesQueryString(query)}`,
  );
}

export async function fetchAllClasses(
  api: HttpClient,
  query: Omit<ClassesQuery, 'page' | 'pageSize'> = {},
) {
  const pageSize = 100;
  const first = await fetchClasses(api, { ...query, page: 1, pageSize });
  const pageCount = Math.ceil(first.meta.total / first.meta.pageSize);
  const remaining = await Promise.all(Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
    fetchClasses(api, { ...query, page: index + 2, pageSize }),
  ));
  const unique = new Map<number, ClassView>();
  for (const gymClass of [...first.data, ...remaining.flatMap((page) => page.data)]) unique.set(gymClass.id, gymClass);
  return [...unique.values()];
}

export function fetchClass(
  api: HttpClient,
  id: number | string,
) {
  return api.request<ApiData<ClassView>>(
    `/classes/${id}`,
  );
}

export function createClass(
  api: HttpClient,
  input: ClassCreateInput,
) {
  return api.request<ApiData<ClassView>>(
    '/classes',
    {
      method: 'POST',
      body: input,
    },
  );
}

export function createClassesBatch(
  api: HttpClient,
  input: ClassBatchCreateInput,
) {
  return api.request<ApiData<ClassView[]>>(
    '/classes/batch',
    {
      method: 'POST',
      body: input,
    },
  );
}

export function updateClass(
  api: HttpClient,
  id: number | string,
  input: ClassPatchInput,
) {
  return api.request<ApiData<ClassView>>(
    `/classes/${id}`,
    {
      method: 'PATCH',
      body: input,
    },
  );
}

export function cancelClass(
  api: HttpClient,
  id: number | string,
) {
  return api.request<ApiData<ClassCancellation>>(
    `/classes/${id}/cancel`,
    {
      method: 'POST',
    },
  );
}
