import { z } from 'zod';
import { booleanQuery, idParams, idSchema, paginationSchema } from '../../shared/validation.js';

const idField = z.number().int().positive().max(2147483647);
const instantQuery = z.iso.datetime({ offset: true });

export const enrollmentIdParamsSchema = idParams;
export const enrollmentCreateMemberSchema = z.object({ classId: idField, memberId: idField.optional() }).strict();
export const enrollmentCreateAdminSchema = z.object({ classId: idField, memberId: idField }).strict();
export const eligibilityQuerySchema = z.object({ memberId: idSchema.optional() }).strict();
export const enrollmentsQuerySchema = paginationSchema.extend({
  memberId: idSchema.optional(),
  classId: idSchema.optional(),
  cancelled: booleanQuery.optional(),
  from: instantQuery.optional(),
  to: instantQuery.optional(),
}).strict().superRefine((query, context) => {
  if (query.from && query.to && new Date(query.to) <= new Date(query.from)) {
    context.addIssue({ code: 'custom', path: ['to'], message: 'El límite final debe ser posterior al inicial.' });
  }
});

export type EnrollmentCreateInput = z.infer<typeof enrollmentCreateMemberSchema>;
export type EnrollmentsQuery = z.infer<typeof enrollmentsQuerySchema>;
