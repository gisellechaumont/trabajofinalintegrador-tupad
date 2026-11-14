import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env.js';
import { AppError } from './errors.js';

const key = new TextEncoder().encode(env.JWT_SECRET);
export function createToken(userId: number) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(String(userId)).setIssuedAt().setExpirationTime('1h')
    .setIssuer(env.JWT_ISSUER).setAudience(env.JWT_AUDIENCE).sign(key);
}
export async function verifyToken(token: string) {
  try {
    const result = await jwtVerify(token, key, { algorithms: ['HS256'], issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE, requiredClaims: ['sub', 'iat', 'exp'] });
    const sub = result.payload.sub;
    if (result.protectedHeader.typ !== 'JWT' || typeof sub !== 'string' || !/^[1-9]\d*$/.test(sub) || !Number.isSafeInteger(Number(sub)) || Number(sub) > 2147483647) throw new Error('Invalid subject');
    return Number(sub);
  } catch {
    throw new AppError(401, 'INVALID_SESSION', 'Tu sesión finalizó. Volvé a iniciar sesión.');
  }
}
