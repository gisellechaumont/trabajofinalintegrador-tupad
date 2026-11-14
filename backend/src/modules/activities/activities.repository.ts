import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { rethrowUnique } from '../../shared/errors.js';
import type { ActivitiesQuery } from './activities.validation.js';

export async function listActivities(query: ActivitiesQuery) {
  const where: Prisma.ActivityWhereInput = {
    ...(query.active !== undefined ? { active: query.active } : {}),
    ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
  };
  const [data, total] = await prisma.$transaction([
    prisma.activity.findMany({ where, orderBy: { id: 'asc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.activity.count({ where }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
}
export function findActivity(id: number) { return prisma.activity.findUnique({ where: { id } }); }
export async function insertActivity(data: { name: string; description?: string | null }) {
  try { return await prisma.activity.create({ data }); }
  catch (error) { return rethrowUnique(error, 'NAME_IN_USE', 'Ya existe una actividad con ese nombre.'); }
}
export async function updateActivity(id: number, data: { name?: string; description?: string | null; active?: boolean }) {
  try { return await prisma.activity.update({ where: { id }, data }); }
  catch (error) { return rethrowUnique(error, 'NAME_IN_USE', 'Ya existe una actividad con ese nombre.'); }
}
