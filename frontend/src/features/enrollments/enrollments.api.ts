import type { ApiData, ApiPage, HttpClient } from '../../shared/types/api';
import type {
  EnrollmentCreateAdminInput,
  EnrollmentCreateMemberInput,
  EnrollmentEligibility,
  EnrollmentRecord,
  EnrollmentsQuery,
  EligibilityReason,
} from './enrollments.types';
import type { MemberPackage } from '../packages/packages.types';

interface EligibilityWireResponse {
  canEnroll: boolean;
  message: string;
  reasonCode: EligibilityReason | null;
  selectedPackage: MemberPackage | null;
  expectedRemainingCredits: number | null;
}

function queryString(query: object) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const result = params.toString();
  return result ? `?${result}` : '';
}

function normalizeEligibility(wire: EligibilityWireResponse): EnrollmentEligibility {
  return {
    canEnroll: wire.canEnroll,
    reason: wire.reasonCode,
    message: wire.message,
    memberPackageId: wire.selectedPackage?.id ?? null,
    packageTypeName: wire.selectedPackage?.packageType.name ?? null,
    remainingCredits: wire.selectedPackage?.remainingCredits ?? null,
    remainingCreditsAfterEnrollment: wire.expectedRemainingCredits,
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
