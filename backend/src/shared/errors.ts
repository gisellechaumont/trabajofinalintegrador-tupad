import { Prisma } from '../generated/prisma/client.js';

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public fields: Record<string, string> = {}) {
    super(message);
  }
}

export function rethrowUnique(error: unknown, code: string, message: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new AppError(409, code, message);
  }
  throw error;
}
