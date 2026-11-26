import type { NamedRef } from '../classes/classes.types';

export type EligibilityReason =
  | 'CLASS_FULL'
  | 'CLASS_CANCELLED'
  | 'CLASS_STARTED'
  | 'ALREADY_ENROLLED'
  | 'NO_USABLE_PACKAGE';

export interface EnrollmentEligibility {
  canEnroll: boolean;
  reason: EligibilityReason | null;
  message: string;
  memberPackageId: number | null;
  packageTypeName: string | null;
  remainingCredits: number | null;
  remainingCreditsAfterEnrollment: number | null;
}

export type EnrollmentAttendanceStatus = 'PENDING' | 'PRESENT' | 'ABSENT';

export interface EnrollmentMemberPackage {
  packageType: NamedRef;
  remainingCredits: number;
}

export interface EnrollmentRecord {
  id: number;
  memberId: number;
  classId: number;
  memberPackageId: number;
  cancelled: boolean;
  cancelledAt: string | null;
  creditRefunded: boolean;
  attendanceStatus: EnrollmentAttendanceStatus;
  attendanceRecordedBy: number | null;
  attendanceRecordedAt: string | null;
  createdAt: string;
  member: NamedRef;
  memberPackage: EnrollmentMemberPackage;
  class: {
    startsAt: string;
    endsAt: string;
    cancelled: boolean;
    activity: NamedRef;
    professor: NamedRef;
  };
}

export interface EnrollmentCreateMemberInput {
  classId: number;
}

export interface EnrollmentCreateAdminInput extends EnrollmentCreateMemberInput {
  memberId: number;
}

export interface EnrollmentsQuery {
  page?: number;
  pageSize?: number;
  memberId?: number;
  classId?: number;
  cancelled?: boolean;
  from?: string;
  to?: string;
}

export type MemberEnrollmentView = 'upcoming' | 'past' | 'cancelled' | 'all';
