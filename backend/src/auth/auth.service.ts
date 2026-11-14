import { AppError } from '../../shared/errors.js';
import { dummyPasswordHash, hashPassword, verifyPassword } from '../../shared/password.js';
import { createToken } from '../../shared/token.js';
import { publicUser } from '../users/users.repository.js';
import * as repository from './auth.repository.js';

export async function login(email: string, password: string) {
  const user = await repository.credentialsByEmail(email);
  const valid = await verifyPassword(user?.passwordHash ?? await dummyPasswordHash, password);
  if (!user?.active || !valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'El correo electrónico o la contraseña son incorrectos.');
  return { accessToken: await createToken(user.id), tokenType: 'Bearer', expiresIn: 3600, user: publicUser({ id: user.id, name: user.name, email: user.email, role: user.role, active: user.active }) };
}
export async function changePassword(id: number, currentPassword: string, newPassword: string) {
  const user = await repository.credentialsById(id);
  if (!user?.active) throw new AppError(401, 'INVALID_SESSION', 'Tu sesión no está disponible.');
  if (!await verifyPassword(user.passwordHash, currentPassword)) {
    throw new AppError(422, 'INVALID_CURRENT_PASSWORD', 'La contraseña actual no es correcta.', { currentPassword: 'Revisá tu contraseña actual.' });
  }
  await repository.updatePassword(id, await hashPassword(newPassword));
}
