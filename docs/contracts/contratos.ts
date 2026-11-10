/** GymFlow: contratos 1.0. Definiciones, no implementación ejecutable. */
export type Role = 'ADMIN' | 'PROFESSOR' | 'MEMBER';
export type AttendanceStatus = 'PENDING' | 'PRESENT' | 'ABSENT';
export type PackageStatus = 'NOT_STARTED' | 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED';
export type ClassStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';
export type ISODate = string; // YYYY-MM-DD, fecha civil de negocio.
export type ISOInstant = string; // RFC3339; respuestas UTC con Z.
export interface Identity { id: number; role: Role }
export interface User extends Identity { name: string; email: string; active: boolean }
export interface PersonRef { id: number; name: string }
export interface Activity { id: number; name: string; description: string | null; active: boolean }
export interface ClassView {
  id: number; activity: { id: number; name: string }; professor: PersonRef;
  startsAt: ISOInstant; endsAt: ISOInstant; capacity: number;
  occupiedSpots: number; availableSpots: number; cancelled: boolean; status: ClassStatus;
}
export interface PackageType {
  id: number; name: string; classCredits: number; durationDays: number; active: boolean;
}
export interface MemberPackage {
  id: number; member: PersonRef; packageType: { id: number; name: string };
  startsOn: ISODate; expiresOn: ISODate; initialCredits: number;
  remainingCredits: number; assignedAt: ISOInstant; status: PackageStatus; expiringSoon: boolean;
}
export interface Enrollment {
  id: number; class: ClassView; member: PersonRef; memberPackageId: number;
  cancelled: boolean; createdAt: ISOInstant; cancelledAt: ISOInstant | null;
  creditRefunded: boolean; attendanceStatus: AttendanceStatus;
  attendanceRecordedBy: number | null; attendanceRecordedAt: ISOInstant | null;
}
export interface Eligibility {
  canEnroll: boolean; reasonCode: string | null; message: string;
  selectedPackage: MemberPackage | null; expectedRemainingCredits: number | null;
}
export interface RosterEntry {
  enrollmentId: number; member: PersonRef; availableCredits: number;
  attendanceStatus: AttendanceStatus; attendanceRecordedBy: number | null;
  attendanceRecordedAt: ISOInstant | null;
}
export interface AttendanceInput {
  items: Array<{ enrollmentId: number; status: 'PRESENT' | 'ABSENT' }>;
}
export interface ClassCancellation { class: ClassView; cancelledEnrollments: number; refundedCredits: number }
export interface HistoryView {
  enrollments: Enrollment[]; attendancePercentage: number | null;
  presentCount: number; absentCount: number; pendingCount: number;
  meta: { page: number; pageSize: number; total: number };
}
export interface Dashboard {
  activeMembers: number; scheduledClassesToday: number; fullClasses: ClassView[];
  expiringPackages: MemberPackage[]; upcomingClasses: ClassView[];
}
export interface ApiData<T> { data: T }
export interface ApiPage<T> { data: T[]; meta: { page: number; pageSize: number; total: number } }
export interface ApiError { error: { code: string; message: string; fields: Record<string, string> } }
export interface Session { accessToken: string; tokenType: 'Bearer'; expiresIn: number; user: User }
export interface LoginInput { email: string; password: string }
export interface UserCreate { name: string; email: string; password: string; role: 'MEMBER' | 'PROFESSOR' }
export interface UserPatch { name?: string; email?: string; active?: boolean }
export interface ActivityInput { name: string; description?: string | null }
export interface ClassCreate { activityId: number; professorId: number; startsAt: ISOInstant; endsAt: ISOInstant; capacity: number }
export type ClassPatch = Partial<ClassCreate>;
export interface PackageTypeInput { name: string; classCredits: number; durationDays: number }
export interface PackageAssignment { memberId: number; packageTypeId: number; startsOn: ISODate }
export interface EnrollmentInput { classId: number; memberId?: number } // memberId: ADMIN o id propio.

/** Solo interfaz lógica. La implementación se prepara en la base compartida. */
export interface HttpClient {
  request<T>(path: string, options?: {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT'; body?: unknown; signal?: AbortSignal;
  }): Promise<T>;
}
/** Token en memoria; no localStorage. Un 401 limpia sesión y datos privados. */
export interface SessionContext {
  user: User | null; accessToken: string | null;
  login(credentials: LoginInput): Promise<void>;
  logout(): void;
}
/** Entrada serializable de navegación; los componentes de React van en su grupo. */
export interface NavigationEntry { path: string; label: string; roles: Role[] }

// Puntos de montaje acordados (a implementar, NO existen por incluir este archivo):
// backend/src/modules/operational.routes.ts exporta operationalRouter (Express.Router).
// app.ts lo monta UNA vez bajo /api/v1; cada ruta aplica requireAuth y allowRoles.
// frontend/src/features/operational.routes.tsx exporta OperationalRoutes (componente)
// y operationalNavigation: NavigationEntry[]. Sus pantallas consumen SessionContext.
// Cada integración concreta se fija en el commit base y respeta estos contratos.
