import { AppError } from '../../shared/errors.js';
import type { Identity } from '../../shared/types.js';
import * as repository from './enrollments.repository.js';
import type { EnrollmentsQuery } from './enrollments.validation.js';

export async function eligibility(classId: number, memberId: number) {
  return { data: await repository.checkEligibility(memberId, classId) };
}

export async function enroll(classId: number, requestedMemberId: number | undefined, requester: Identity) {
  const memberId = requester.role === 'ADMIN' ? requestedMemberId : requester.id;
  if (memberId === undefined) throw new AppError(422, 'VALIDATION_ERROR', 'Indicá el socio para crear la inscripción.', { memberId: 'Este campo es obligatorio para administración.' });
  if (requester.role === 'MEMBER' && requestedMemberId !== undefined && requestedMemberId !== requester.id) {
    throw new AppError(403, 'FORBIDDEN', 'No tenés permisos para operar sobre otro socio.');
  }
  return { data: await repository.createEnrollment(memberId, classId) };
}

export async function list(query: EnrollmentsQuery, requester: Identity) {
  return repository.listEnrollments(query, requester.role === 'MEMBER' ? requester.id : undefined);
}

export async function detail(id: number, requester: Identity) {
  const row = await repository.findEnrollment(id);
  if (!row) throw new AppError(404, 'NOT_FOUND', 'No se encontró la inscripción.');
  if (requester.role === 'MEMBER' && row.memberId !== requester.id) {
    throw new AppError(403, 'FORBIDDEN', 'No tenés permisos para consultar esta inscripción.');
  }
  return { data: row };
}

export async function cancel(id: number, requester: Identity) {
  return { data: await repository.cancelEnrollment(id, requester.id, requester.role === 'ADMIN') };
}
