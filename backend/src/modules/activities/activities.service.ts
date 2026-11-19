import { AppError } from '../../shared/errors.js';
import type { Role } from '../../shared/types.js';
import * as repository from './activities.repository.js';
import type { ActivitiesQuery } from './activities.validation.js';

export function listActivities(query: ActivitiesQuery, role: Role) {
  if (role !== 'ADMIN' && query.active === false) throw new AppError(403, 'FORBIDDEN', 'Solo administración puede consultar actividades inactivas.');
  return repository.listActivities(role === 'ADMIN' ? query : { ...query, active: true });
}
export async function getActivity(id: number, role: Role) {
  const row = await repository.findActivity(id);
  if (!row) throw new AppError(404, 'NOT_FOUND', 'No se encontró la actividad.');
  if (!row.active && role !== 'ADMIN') throw new AppError(403, 'FORBIDDEN', 'Esta actividad no está disponible.');
  return row;
}
export async function patchActivity(id: number, data: { name?: string; description?: string | null; active?: boolean }) {
  await getActivity(id, 'ADMIN');
  return repository.updateActivity(id, data);
}
