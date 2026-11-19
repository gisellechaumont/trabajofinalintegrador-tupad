export type ClassStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'FINISHED'
  | 'CANCELLED';

export interface NamedRef {
  id: number;
  name: string;
}

export type ClassOption = NamedRef & { active?: boolean };

export interface ClassView {
  id: number;
  activity: NamedRef;
  professor: NamedRef;
  startsAt: string;
  endsAt: string;
  capacity: number;
  occupiedSpots: number;
  availableSpots: number;
  cancelled: boolean;
  status: ClassStatus;
}

export interface ClassCreateInput {
  activityId: number;
  professorId: number;
  startsAt: string;
  endsAt: string;
  capacity: number;
}

export interface ClassBatchCreateInput extends ClassCreateInput {
  daysOfWeek: number[];
  repeatUntil: string;
}

export type ClassPatchInput =
  Partial<ClassCreateInput>;

export interface ClassesQuery {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  activityId?: number;
  professorId?: number;
  status?: ClassStatus;
}

export interface ClassCancellation {
  class: ClassView;
  cancelledEnrollments: number;
  refundedCredits: number;
}
