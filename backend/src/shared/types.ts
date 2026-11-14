import { z } from 'zod';
export const roleSchema = z.enum(['ADMIN', 'PROFESSOR', 'MEMBER']);
export type Role = z.infer<typeof roleSchema>;
export interface Identity { id: number; role: Role }
export interface PublicUser extends Identity { name: string; email: string; active: boolean }

declare global {
  namespace Express {
    interface Request { user?: Identity }
  }
}
