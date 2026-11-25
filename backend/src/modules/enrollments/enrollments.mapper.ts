import { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors.js';

export type EnrollmentAttendanceStatus = 'PENDING' | 'PRESENT' | 'ABSENT';

export const enrollmentViewSelect = {
  id: true,
  classId: true,
  memberId: true,
  memberPackageId: true,
  cancelled: true,
  cancelledAt: true,
  creditRefunded: true,
  attendanceStatus: true,
  attendanceRecordedBy: true,
  attendanceRecordedAt: true,
  createdAt: true,
  member: { select: { id: true, name: true } },
  class: {
    select: {
      startsAt: true,
      endsAt: true,
      cancelled: true,
      activity: { select: { id: true, name: true } },
      professor: { select: { id: true, name: true } },
    },
  },
  package: {
    select: {
      remainingCredits: true,
      packageType: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.EnrollmentSelect;

export type EnrollmentViewRow = Prisma.EnrollmentGetPayload<{ select: typeof enrollmentViewSelect }>;

export interface EnrollmentView {
  id: number;
  classId: number;
  memberId: number;
  memberPackageId: number;
  cancelled: boolean;
  cancelledAt: string | null;
  creditRefunded: boolean;
  attendanceStatus: EnrollmentAttendanceStatus;
  attendanceRecordedBy: number | null;
  attendanceRecordedAt: string | null;
  createdAt: string;
  member: { id: number; name: string };
  class: {
    startsAt: string;
    endsAt: string;
    cancelled: boolean;
    activity: { id: number; name: string };
    professor: { id: number; name: string };
  };
  memberPackage: {
    packageType: { id: number; name: string };
    remainingCredits: number;
  };
}

function toAttendanceStatus(value: string): EnrollmentAttendanceStatus {
  switch (value) {
    case 'PENDING':
    case 'PRESENT':
    case 'ABSENT':
      return value;
    default:
      throw new AppError(500, 'INTERNAL_ERROR', 'La inscripción contiene un estado de asistencia inválido.');
  }
}

export function toEnrollmentView(row: EnrollmentViewRow): EnrollmentView {
  return {
    id: row.id,
    classId: row.classId,
    memberId: row.memberId,
    memberPackageId: row.memberPackageId,
    cancelled: row.cancelled,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    creditRefunded: row.creditRefunded,
    attendanceStatus: toAttendanceStatus(row.attendanceStatus),
    attendanceRecordedBy: row.attendanceRecordedBy,
    attendanceRecordedAt: row.attendanceRecordedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    member: row.member,
    class: {
      startsAt: row.class.startsAt.toISOString(),
      endsAt: row.class.endsAt.toISOString(),
      cancelled: row.class.cancelled,
      activity: row.class.activity,
      professor: row.class.professor,
    },
    memberPackage: {
      packageType: row.package.packageType,
      remainingCredits: row.package.remainingCredits,
    },
  };
}
