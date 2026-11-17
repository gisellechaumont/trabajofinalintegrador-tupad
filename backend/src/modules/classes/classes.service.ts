import { AppError } from '../../shared/errors.js';
import type { Identity } from '../../shared/types.js';
import * as repository from './classes.repository.js';
import type {
  ClassesQuery,
  CreateClassInput,
  PatchClassInput,
} from './classes.validation.js';

async function validateActivity(
  activityId: number,
) {
  const activity =
    await repository.findActivityForClass(
      activityId,
    );

  if (!activity) {
    throw new AppError(
      404,
      'ACTIVITY_NOT_FOUND',
      'No se encontró la actividad.',
    );
  }

  if (!activity.active) {
    throw new AppError(
      409,
      'INACTIVE_ACTIVITY',
      'La actividad seleccionada está inactiva.',
    );
  }
}

async function validateProfessor(
  professorId: number,
) {
  const professor =
    await repository.findProfessorForClass(
      professorId,
    );

  if (!professor) {
    throw new AppError(
      404,
      'PROFESSOR_NOT_FOUND',
      'No se encontró el profesor.',
    );
  }

  if (professor.role !== 'PROFESSOR') {
    throw new AppError(
      409,
      'INVALID_PROFESSOR',
      'El usuario seleccionado no es profesor.',
    );
  }

  if (!professor.active) {
    throw new AppError(
      409,
      'INACTIVE_USER',
      'El profesor seleccionado está inactivo.',
    );
  }
}

function validateSchedule(
  startsAt: string,
  endsAt: string,
) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (start <= new Date()) {
    throw new AppError(
      422,
      'CLASS_MUST_BE_FUTURE',
      'La clase debe comenzar en una fecha futura.',
      {
        startsAt:
          'Elegí una fecha y hora futura.',
      },
    );
  }

  if (end <= start) {
    throw new AppError(
      422,
      'INVALID_CLASS_TIME',
      'La finalización debe ser posterior al inicio.',
      {
        endsAt:
          'Elegí una hora posterior al inicio.',
      },
    );
  }
}

export function listClasses(
  query: ClassesQuery,
  requester: Identity,
) {
  if (requester.role === 'MEMBER') {
    return repository.listClasses({ ...query, status: query.status ?? 'SCHEDULED' });
  }
  return repository.listClasses(query);
}

export async function getClass(
  id: number,
  requester: Identity,
) {
  const row = await repository.findClass(id);

  if (!row) {
    throw new AppError(
      404,
      'NOT_FOUND',
      'No se encontró la clase.',
    );
  }

  return repository.classView(row);
}

export async function createClass(
  input: CreateClassInput,
) {
  validateSchedule(
    input.startsAt,
    input.endsAt,
  );

  await Promise.all([
    validateActivity(input.activityId),
    validateProfessor(input.professorId),
  ]);

  return repository.insertClass(input);
}

export async function patchClass(
  id: number,
  input: PatchClassInput,
) {
  const current = await repository.findClass(id);
  if (!current) throw new AppError(404, 'NOT_FOUND', 'No se encontró la clase.');
  if (current.cancelled) throw new AppError(409, 'ALREADY_CANCELLED', 'La clase ya está cancelada.');
  if (current.startsAt <= new Date()) throw new AppError(409, 'CLASS_STARTED', 'No se puede modificar una clase que ya comenzó.');
  const startsAt = input.startsAt ?? current.startsAt.toISOString();
  const endsAt = input.endsAt ?? current.endsAt.toISOString();
  validateSchedule(startsAt, endsAt);

  await Promise.all([
    input.activityId !== undefined
      ? validateActivity(input.activityId)
      : Promise.resolve(),

    input.professorId !== undefined
      ? validateProfessor(input.professorId)
      : Promise.resolve(),
  ]);

  return repository.updateClass(id, input);
}

export async function cancelClass(id: number) {
  const current =
    await repository.findClass(id);

  if (!current) {
    throw new AppError(
      404,
      'NOT_FOUND',
      'No se encontró la clase.',
    );
  }

  if (current.cancelled) {
    throw new AppError(
      409,
      'ALREADY_CANCELLED',
      'La clase ya está cancelada.',
    );
  }

  if (current.startsAt <= new Date()) {
    throw new AppError(
      409,
      'CLASS_STARTED',
      'No se puede cancelar una clase que ya comenzó.',
    );
  }

  const result =
    await repository.cancelClassAndRefund(id);

  if (!result) {
    throw new AppError(
      409,
      'ALREADY_CANCELLED',
      'La clase ya está cancelada.',
    );
  }

  return result;
}
