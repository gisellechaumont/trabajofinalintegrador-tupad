import { z } from 'zod';
import {
  idSchema,
  paginationSchema,
} from '../../shared/validation.js';

const isoInstantSchema = z.iso.datetime({
  offset: true,
  error: 'Ingresá una fecha y hora válida con zona horaria.',
});

const capacitySchema = z.number()
  .int('El cupo debe ser un número entero.')
  .positive('El cupo debe ser mayor que cero.');

const classFields = {
  activityId: z.number()
    .int()
    .positive('Seleccioná una actividad válida.'),

  professorId: z.number()
    .int()
    .positive('Seleccioná un profesor válido.'),

  startsAt: isoInstantSchema,
  endsAt: isoInstantSchema,
  capacity: capacitySchema,
};

function validateTimeRange(
  data: { startsAt?: string; endsAt?: string },
  context: z.RefinementCtx,
) {
  if (
    data.startsAt &&
    data.endsAt &&
    new Date(data.endsAt) <= new Date(data.startsAt)
  ) {
    context.addIssue({
      code: 'custom',
      path: ['endsAt'],
      message: 'La finalización debe ser posterior al inicio.',
    });
  }
}

export const createClassSchema = z.object(classFields)
  .strict()
  .superRefine(validateTimeRange);

export const patchClassSchema = z.object({
  activityId: classFields.activityId.optional(),
  professorId: classFields.professorId.optional(),
  startsAt: classFields.startsAt.optional(),
  endsAt: classFields.endsAt.optional(),
  capacity: classFields.capacity.optional(),
})
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    'Ingresá al menos un cambio.',
  )
  .superRefine(validateTimeRange);

export const classStatusSchema = z.enum([
  'SCHEDULED',
  'IN_PROGRESS',
  'FINISHED',
  'CANCELLED',
]);

export const classesQuerySchema = paginationSchema.extend({
  from: isoInstantSchema.optional(),
  to: isoInstantSchema.optional(),
  activityId: idSchema.optional(),
  professorId: idSchema.optional(),
  status: classStatusSchema.optional(),
})
  .strict()
  .superRefine((data, context) => {
    if (
      data.from &&
      data.to &&
      new Date(data.to) <= new Date(data.from)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'El límite final debe ser posterior al inicial.',
      });
    }
  });

export type CreateClassInput = z.infer<
  typeof createClassSchema
>;

export type PatchClassInput = z.infer<
  typeof patchClassSchema
>;

export type ClassesQuery = z.infer<
  typeof classesQuerySchema
>;

export type ClassStatus = z.infer<
  typeof classStatusSchema
>;