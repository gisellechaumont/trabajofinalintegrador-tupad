import { randomBytes } from 'node:crypto';
import { Algorithm, hash, verify } from '@node-rs/argon2';

export function hashPassword(password: string) {
  return hash(password, { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 });
}
export async function verifyPassword(encoded: string, password: string) {
  try { return await verify(encoded, password); }
  catch { return false; }
}

// Mismo trabajo de hash cuando el correo no existe. No es una cuenta ni una clave de acceso.
export const dummyPasswordHash = hashPassword(randomBytes(32).toString('hex'));
