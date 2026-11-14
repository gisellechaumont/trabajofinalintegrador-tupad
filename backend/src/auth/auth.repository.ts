import { prisma } from '../../config/prisma.js';
import { publicSelect, publicUser } from '../users/users.repository.js';
import { rethrowUnique } from '../../shared/errors.js';

export function credentialsByEmail(email: string) { return prisma.user.findUnique({ where: { email } }); }
export function credentialsById(id: number) { return prisma.user.findUnique({ where: { id } }); }
export async function profileById(id: number) {
  const row = await prisma.user.findUnique({ where: { id }, select: publicSelect });
  return row ? publicUser(row) : null;
}
export async function updateProfile(id: number, input: { name?: string; email?: string }) {
  try { return publicUser(await prisma.user.update({ where: { id }, data: input, select: publicSelect })); }
  catch (error) { return rethrowUnique(error, 'EMAIL_IN_USE', 'El correo ya está registrado.'); }
}
export function updatePassword(id: number, passwordHash: string) {
  return prisma.user.update({ where: { id }, data: { passwordHash }, select: { id: true } });
}
