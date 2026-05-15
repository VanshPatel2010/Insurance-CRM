// ── storage.ts ─────────────────────────────────────────────────────────────────
// All customer data is now stored in MongoDB and accessed via API routes.
// Functions below are thin wrappers around fetch() calls.
// Session authentication is handled server-side in each API route.

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CustomerFilters {
  search?: string;
  type?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface CustomerListResponse {
  customers: CustomerDoc[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CustomerDoc {
  _id: string;
  agentId: string;
  type:
    | 'motor'
    | 'medical'
    | 'fire'
    | 'life'
    | 'personal-accident'
    | 'marine'
    | 'workman-compensation'
    | 'travel';
  customerName: string;
  phone: string;
  email: string;
  address: string;
  policyNumber: string;
  premiumAmount: string;
  sumInsured: string;
  startDate: string;
  endDate: string;
  familyGroupId?: string | { _id: string; familyName: string; primaryPolicyholderName: string } | null;
  familyMemberName?: string;
  familyRelationship?: string;
  referredById?: string | { _id: string; name: string; phone?: string; email?: string } | null;
  commissionType?: 'percentage' | 'flat' | '';
  commissionValue?: string;
  commissionStatus?: 'Pending' | 'Paid';
  details: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  // Spread type-specific fields from details for backwards compat
  [key: string]: unknown;
}

export interface DashboardStats {
  total: number;
  typeCounts: Record<string, number>;
  expiring: CustomerDoc[];
  totalPremium: number;
  recent: CustomerDoc[];
}

export interface FamilyGroupDoc {
  _id: string;
  familyName: string;
  primaryPolicyholderName: string;
  primaryPhone?: string;
  notes?: string;
  policyCount?: number;
  totalPremium?: number;
  renewalAlerts?: number;
}

export interface ReferralMemberDoc {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  totalPolicies?: number;
  totalCommission?: number;
  pendingCommission?: number;
  paidCommission?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Flatten a MongoDB customer document: spreads `details` fields onto the top level
 * so existing components that access e.g. `customer.vehicleMake` still work.
 */
export function flattenCustomer(doc: CustomerDoc): CustomerDoc {
  const { details, ...rest } = doc;
  // Handle legacy double-nested details (details.details.vehicleMake etc.)
  // caused by a previous bug where the form's `details` key wasn't destructured
  const innerDetails = (details && typeof details === 'object' && 'details' in details)
    ? { ...details, ...(details as Record<string, unknown>).details as Record<string, unknown> }
    : details;
  return { ...innerDetails, ...rest } as CustomerDoc;
}

// ── API Wrappers ───────────────────────────────────────────────────────────────

export async function getAllCustomers(
  filters: CustomerFilters = {}
): Promise<CustomerListResponse> {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.type)   params.set('type',   filters.type);
  if (filters.status) params.set('status', filters.status);
  if (filters.page)   params.set('page',   String(filters.page));
  if (filters.limit)  params.set('limit',  String(filters.limit));

  const res = await fetch(`/api/customers?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to fetch customers');
  }
  return res.json();
}

export async function getCustomer(id: string): Promise<CustomerDoc> {
  const res = await fetch(`/api/customers/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to fetch customer');
  }
  return res.json();
}

export async function saveCustomer(data: Record<string, unknown>): Promise<CustomerDoc> {
  const res = await fetch('/api/customers', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to save customer');
  }
  return res.json();
}

export async function updateCustomer(
  id: string,
  data: Record<string, unknown>
): Promise<CustomerDoc> {
  const res = await fetch(`/api/customers/${id}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to update customer');
  }
  return res.json();
}

export async function deleteCustomer(id: string): Promise<{ message: string }> {
  const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to delete customer');
  }
  return res.json();
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await fetch('/api/dashboard/stats');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to fetch dashboard stats');
  }
  return res.json();
}

export async function getFamilyGroups(): Promise<{ familyGroups: FamilyGroupDoc[] }> {
  const res = await fetch('/api/family-groups');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to fetch family groups');
  }
  return res.json();
}

export async function createFamilyGroup(
  data: Record<string, unknown>
): Promise<FamilyGroupDoc> {
  const res = await fetch('/api/family-groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to create family group');
  }
  return res.json();
}

export async function getFamilyGroupDetail(
  id: string
): Promise<{ familyGroup: FamilyGroupDoc; policies: CustomerDoc[] }> {
  const res = await fetch(`/api/family-groups/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to fetch family group');
  }
  return res.json();
}

export async function getReferrals(): Promise<{ referrals: ReferralMemberDoc[] }> {
  const res = await fetch('/api/referrals');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to fetch referrals');
  }
  return res.json();
}

export async function createReferral(
  data: Record<string, unknown>
): Promise<ReferralMemberDoc> {
  const res = await fetch('/api/referrals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to create referral member');
  }
  return res.json();
}

export async function getReferralDetail(
  id: string
): Promise<{
  referral: ReferralMemberDoc;
  policies: Array<CustomerDoc & { commissionAmount: number }>;
  summary: {
    totalReferred: number;
    totalCommission: number;
    pendingCommission: number;
    paidCommission: number;
  };
}> {
  const res = await fetch(`/api/referrals/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to fetch referral detail');
  }
  return res.json();
}

export async function updateReferralCommissions(
  referralId: string,
  policyIds: string[],
  status: 'Pending' | 'Paid',
): Promise<{ updated: number }> {
  const res = await fetch(`/api/referrals/${referralId}/commissions`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ policyIds, status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to update commission status');
  }
  return res.json();
}
