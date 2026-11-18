import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError, rethrowUnique } from '../../shared/errors.js';
import type {
  ClassesQuery,
  ClassStatus,
  CreateClassInput,
  PatchClassInput,
} from './classes.validation.js';

const classInclude = {
  activity: {
    select: {
      id: true,
      name: true,
    },
  },
  professor: {
    select: {
      id: true,
      name: true,
    },
  },
  _count: {
    select: {
      enrollments: {
        where: {
          cancelled: false,
        },
      },
    },
  },
} satisfies Prisma.ClassInclude;

type ClassRow = Prisma.ClassGetPayload<{
  include: typeof classInclude;
}>;

function classStatus(
  row: ClassRow,
  now: Date,
): ClassStatus {
  if (row.cancelled) return 'CANCELLED';
  if (row.startsAt > now) return 'SCHEDULED';
  if (row.endsAt > now) return 'IN_PROGRESS';
  return 'FINISHED';
}

export function classView(
  row: ClassRow,
  now = new Date(),
) {
  const occupiedSpots = row._count.enrollments;

  return {
    id: row.id,
    activity: row.activity,
    professor: row.professor,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    capacity: row.capacity,
    occupiedSpots,
    availableSpots: Math.max(
      0,
      row.capacity - occupiedSpots,
    ),
    cancelled: row.cancelled,
    status: classStatus(row, now),
  };
}

function statusWhere(
  status: ClassStatus,
  now: Date,
): Prisma.ClassWhereInput {
  switch (status) {
    case 'CANCELLED':
      return {
        cancelled: true,
      };

    case 'SCHEDULED':
      return {
        cancelled: false,
        startsAt: {
          gt: now,
        },
      };

    case 'IN_PROGRESS':
      return {
        cancelled: false,
        startsAt: {
          lte: now,
        },
        endsAt: {
          gt: now,
        },
      };

    case 'FINISHED':
      return {
        cancelled: false,
        endsAt: {
          lte: now,
        },
      };
  }
}

export async function listClasses(
  query: ClassesQuery,
) {
  const now = new Date();
  const conditions: Prisma.ClassWhereInput[] = [];

  if (query.from || query.to) {
    conditions.push({
      startsAt: {
        ...(query.from
          ? { gte: new Date(query.from) }
          : {}),
        ...(query.to
          ? { lt: new Date(query.to) }
          : {}),
      },
    });
  }

  if (query.activityId) {
    conditions.push({
      activityId: query.activityId,
    });
  }

  if (query.professorId) {
    conditions.push({
      professorId: query.professorId,
    });
  }

  if (query.status) {
    conditions.push(
      statusWhere(query.status, now),
    );
  }

  const where: Prisma.ClassWhereInput =
    conditions.length
      ? { AND: conditions }
      : {};

  const [rows, total] = await prisma.$transaction(
    [
      prisma.class.findMany({
        where,
        include: classInclude,
        orderBy: [
          { startsAt: 'asc' },
          { id: 'asc' },
        ],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),

      prisma.class.count({
        where,
      }),
    ],
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel
          .RepeatableRead,
    },
  );

  return {
    data: rows.map((row) =>
      classView(row, now),
    ),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
    },
  };
}

export function findClass(id: number) {
  return prisma.class.findUnique({
    where: {
      id,
    },
    include: classInclude,
  });
}

export function findActivityForClass(id: number) {
  return prisma.activity.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      active: true,
    },
  });
}

export function findProfessorForClass(id: number) {
  return prisma.user.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      role: true,
      active: true,
    },
  });
}

export async function insertClass(
  input: CreateClassInput,
) {
  try {
    const row = await prisma.class.create({
      data: {
        activityId: input.activityId,
        professorId: input.professorId,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        capacity: input.capacity,
      },
      include: classInclude,
    });

    return classView(row);
  } catch (error) {
    return rethrowUnique(
      error,
      'CLASS_SCHEDULE_CONFLICT',
      'Ya existe una clase con esa actividad, profesor y horario de inicio.',
    );
  }
}

export async function insertClassesBatch(
  inputs: CreateClassInput[],
) {
  try {
    const rows = await serializable(async (transaction) => {
      const created: ClassRow[] = [];
      for (const input of inputs) {
        created.push(await transaction.class.create({
          data: {
            activityId: input.activityId,
            professorId: input.professorId,
            startsAt: new Date(input.startsAt),
            endsAt: new Date(input.endsAt),
            capacity: input.capacity,
          },
          include: classInclude,
        }));
      }
      return created;
    });

    return rows.map((row) => classView(row));
  } catch (error) {
    return rethrowUnique(
      error,
      'CLASS_SCHEDULE_CONFLICT',
      'Una de las clases ya existe para esa actividad, profesor y horario de inicio. No se creó ninguna clase del lote.',
    );
  }
}

export async function updateClass(
  id: number,
  input: PatchClassInput,
) {
  try {
    const row = await serializable(async (transaction) => {
      await lockClass(transaction, id);
      const current = await transaction.class.findUnique({
        where: { id }, include: classInclude,
      });
      if (!current) throw new AppError(404, 'NOT_FOUND', 'No se encontró la clase.');
      if (current.cancelled) throw new AppError(409, 'ALREADY_CANCELLED', 'La clase ya está cancelada.');
      if (current.startsAt <= new Date()) throw new AppError(409, 'CLASS_STARTED', 'No se puede modificar una clase que ya comenzó.');
      const occupied = current._count.enrollments;
      const hasRealScheduleChange =
        (input.activityId !== undefined && input.activityId !== current.activityId)
        || (input.professorId !== undefined && input.professorId !== current.professorId)
        || (input.startsAt !== undefined && new Date(input.startsAt).getTime() !== current.startsAt.getTime())
        || (input.endsAt !== undefined && new Date(input.endsAt).getTime() !== current.endsAt.getTime());
      if (occupied > 0 && hasRealScheduleChange) {
        throw new AppError(409, 'CLASS_HAS_ENROLLMENTS', 'La clase tiene inscripciones activas. Solo se puede modificar su capacidad.');
      }
      if (input.capacity !== undefined && input.capacity < occupied) {
        throw new AppError(409, 'CAPACITY_BELOW_ENROLLMENTS', 'El cupo no puede ser menor que la cantidad de socios inscriptos.', { capacity: `Actualmente hay ${occupied} socios inscriptos.` });
      }
      const data: Prisma.ClassUpdateInput = {

        ...(input.startsAt !== undefined
          ? { startsAt: new Date(input.startsAt) }
          : {}),

        ...(input.endsAt !== undefined
          ? { endsAt: new Date(input.endsAt) }
          : {}),

        ...(input.capacity !== undefined
          ? { capacity: input.capacity }
          : {}),
      };
      if (input.activityId !== undefined) data.activity = { connect: { id: input.activityId } };
      if (input.professorId !== undefined) data.professor = { connect: { id: input.professorId } };
      return transaction.class.update({ where: { id }, data, include: classInclude });
    });

    return classView(row);
  } catch (error) {
    return rethrowUnique(
      error,
      'CLASS_SCHEDULE_CONFLICT',
      'Ya existe una clase con esa actividad, profesor y horario de inicio.',
    );
  }
}

export async function cancelClassAndRefund(
  id: number,
) {
  return serializable(async (transaction) => {
      await lockClass(transaction, id);
      const current = await transaction.class.findUnique({ where: { id } });
      if (!current) throw new AppError(404, 'NOT_FOUND', 'No se encontró la clase.');
      if (current.cancelled) return null;
      if (current.startsAt <= new Date()) throw new AppError(409, 'CLASS_STARTED', 'No se puede cancelar una clase que ya comenzó.');
      await transaction.class.update({ where: { id }, data: { cancelled: true } });

      const activeEnrollments =
        await transaction.enrollment.findMany({
          where: {
            classId: id,
            cancelled: false,
          },
          select: {
            id: true,
            memberPackageId: true,
          },
          orderBy: [
            { memberPackageId: 'asc' },
            { id: 'asc' },
          ],
        });

      const refundsByPackage =
        new Map<number, number>();

      for (const enrollment of activeEnrollments) {
        refundsByPackage.set(
          enrollment.memberPackageId,
          (
            refundsByPackage.get(
              enrollment.memberPackageId,
            ) ?? 0
          ) + 1,
        );
      }

      for (
        const [memberPackageId, credits]
        of refundsByPackage
      ) {
        await transaction.memberPackage.update({
          where: {
            id: memberPackageId,
          },
          data: {
            remainingCredits: {
              increment: credits,
            },
          },
        });
      }

      const cancelledAt = new Date();

      if (activeEnrollments.length > 0) {
        await transaction.enrollment.updateMany({
          where: {
            id: {
              in: activeEnrollments.map(
                ({ id: enrollmentId }) =>
                  enrollmentId,
              ),
            },
          },
          data: {
            cancelled: true,
            cancelledAt,
            creditRefunded: true,
          },
        });
      }

      const row =
        await transaction.class.findUniqueOrThrow({
          where: {
            id,
          },
          include: classInclude,
        });

      return {
        class: classView(row, cancelledAt),
        cancelledEnrollments:
          activeEnrollments.length,
        refundedCredits:
          activeEnrollments.length,
      };
    });
}

async function lockClass(transaction: Prisma.TransactionClient, id: number) {
  await transaction.$queryRaw`SELECT id FROM classes WHERE id = ${id} FOR UPDATE`;
}

async function serializable<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        if (attempt < 2) continue;
        throw new AppError(409, 'CONCURRENT_MODIFICATION', 'La clase fue modificada simultáneamente. Volvé a intentar la operación.');
      }
      throw error;
    }
  }
  throw new AppError(409, 'CONCURRENT_MODIFICATION', 'La clase fue modificada simultáneamente. Volvé a intentar la operación.');
}
