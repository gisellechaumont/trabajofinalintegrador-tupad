import type { ApiData, ApiPage, HttpClient } from '../../shared/types/api';
import type {
  EnrollmentCreateAdminInput,
  EnrollmentCreateMemberInput,
  EnrollmentEligibility,
  EnrollmentRecord,
  EnrollmentsQuery,
  EligibilityReason,
} from './enrollments.types';

interface EligibilityWirePackage {
  id?: number;
  packageType?: { name?: string };
  remainingCredits?: number;
}

interface EligibilityWireResponse {
  canEnroll: boolean;
  message: string;
  reason?: EligibilityReason | null;
  reasonCode?: EligibilityReason | null;
  memberPackageId?: number | null;
  packageTypeName?: string | null;
  remainingCredits?: number | null;
  remainingCreditsAfterEnrollment?: number | null;
  selectedPackage?: EligibilityWirePackage | null;
  expectedRemainingCredits?: number | null;
}

function queryString(query: object) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const result = params.toString();
  return result ? `?${result}` : '';
}

/**
 * El backend aún devuelve la forma documentada y campos directos adicionales.
 * Esta normalización temporal concentra la compatibilidad hasta sincronizar OpenAPI.
 */
function normalizeEligibility(wire: EligibilityWireResponse): EnrollmentEligibility {
  const directPackageTypeName = wire.packageTypeName?.trim();
  const compatiblePackageTypeName = wire.selectedPackage?.packageType?.name?.trim();
  return {
    canEnroll: wire.canEnroll,
    reason: wire.reason ?? wire.reasonCode ?? null,
    message: wire.message,
    memberPackageId: wire.memberPackageId ?? wire.selectedPackage?.id ?? null,
    packageTypeName: directPackageTypeName || compatiblePackageTypeName || null,
    remainingCredits: wire.remainingCredits ?? wire.selectedPackage?.remainingCredits ?? null,
    remainingCreditsAfterEnrollment: wire.remainingCreditsAfterEnrollment ?? wire.expectedRemainingCredits ?? null,
  };
}

export async function getEnrollmentEligibility(api: HttpClient, classId: number, memberId?: number, signal?: AbortSignal) {
  const response = await api.request<ApiData<EligibilityWireResponse>>(
    `/classes/${classId}/eligibility${queryString({ memberId })}`,
    { signal },
  );
  return { data: normalizeEligibility(response.data) };
}

export function createMemberEnrollment(api: HttpClient, input: EnrollmentCreateMemberInput) {
  return api.request<ApiData<EnrollmentRecord>>('/enrollments', { method: 'POST', body: input });
}

export function createAdminEnrollment(api: HttpClient, input: EnrollmentCreateAdminInput) {
  return api.request<ApiData<EnrollmentRecord>>('/enrollments', { method: 'POST', body: input });
}

export function listEnrollments(api: HttpClient, query: EnrollmentsQuery) {
  return api.request<ApiPage<EnrollmentRecord>>(`/enrollments${queryString(query)}`);
}

export function getEnrollment(api: HttpClient, id: number | string) {
  return api.request<ApiData<EnrollmentRecord>>(`/enrollments/${id}`);
}

export function cancelEnrollment(api: HttpClient, id: number | string) {
  return api.request<ApiData<EnrollmentRecord>>(`/enrollments/${id}/cancel`, { method: 'POST' });
}
