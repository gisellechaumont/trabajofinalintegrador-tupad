import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { rethrowUnique } from '../../shared/errors.js';
import { roleSchema } from '../../shared/types.js';
import type { UsersQuery, PatchUserInput } from './users.validation.js';

export const publicSelect = { id: true, name: true, email: true, role: true, active: true } satisfies Prisma.UserSelect;
export function publicUser(row: { id: number; name: string; email: string; role: string; active: boolean }) {
  return { ...row, role: roleSchema.parse(row.role) };
}
export async function listUsers(query: UsersQuery) {
  const where: Prisma.UserWhereInput = {
    role: query.role ?? { in: ['MEMBER', 'PROFESSOR'] },
    ...(query.active !== undefined ? { active: query.active } : {}),
    ...(query.search ? { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { email: { contains: query.search, mode: 'insensitive' } }] } : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.user.findMany({ where, select: publicSelect, orderBy: { id: 'asc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.user.count({ where }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  return { data: rows.map(publicUser), meta: { page: query.page, pageSize: query.pageSize, total } };
}
export function findUser(id: number) { return prisma.user.findUnique({ where: { id }, select: publicSelect }); }
export async function insertUser(input: { name: string; email: string; passwordHash: string; role: 'MEMBER' | 'PROFESSOR' }) {
  try { return publicUser(await prisma.user.create({ data: input, select: publicSelect })); }
  catch (error) { return rethrowUnique(error, 'EMAIL_IN_USE', 'El correo ya está registrado.'); }
}
export async function updateUser(id: number, input: PatchUserInput) {
  try { return publicUser(await prisma.user.update({ where: { id }, data: input, select: publicSelect })); }
  catch (error) { return rethrowUnique(error, 'EMAIL_IN_USE', 'El correo ya está registrado.'); }
}
