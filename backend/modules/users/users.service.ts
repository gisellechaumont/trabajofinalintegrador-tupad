import { AppError } from '../../shared/errors.js';
import { hashPassword } from '../../shared/password.js';
import * as repository from './users.repository.js';
import type { CreateUserInput, PatchUserInput } from './users.validation.js';

export async function getManageableUser(id: number) {
  const user = await repository.findUser(id);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'No se encontró el usuario.');
  if (!['MEMBER', 'PROFESSOR'].includes(user.role)) throw new AppError(403, 'FORBIDDEN', 'Esta cuenta no se administra desde socios o profesores.');
  return repository.publicUser(user);
}
export async function createUser(input: CreateUserInput) {
  const passwordHash = await hashPassword(input.password);
  return repository.insertUser({ name: input.name, email: input.email, role: input.role, passwordHash });
}
export async function patchUser(id: number, input: PatchUserInput) {
  await getManageableUser(id);
  // El estado cambia sin borrar ni alterar paquetes, reservas o asistencias.
  return repository.updateUser(id, input);
}
