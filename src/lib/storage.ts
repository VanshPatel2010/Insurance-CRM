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
  companyId?: string | { _id: string; name: string } | null;
  premiumAmount: string;
  premiumWithoutGst?: string;
  sumInsured: string;
  startDate: string;
  endDate: string;
  familyGroupId?: string | { _id: string; familyName: string; primaryPolicyholderName: string } | null;
  familyMemberName?: string;
  familyRelationship?: string;
  referredById?: string | { _id: string; name: string; phone?: string; email?: string } | null;
  referralAgentCode?: string;
  commissionType?: 'percentage' | 'flat' | '';
  commissionValue?: string;
  commissionStatus?: 'Pending' | 'Paid';
  premiumPaidByAgency?: string;
  paymentReceivedFromReferral?: string;
  paymentSentToReferral?: string;
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
  premiumPaidByAgency?: number;
  paymentSentToReferral?: number;
  paymentReceivedFromReferral?: number;
  balance?: number;
  balanceDirection?: 'agency_pays' | 'referral_pays' | 'settled';
  amountDue?: number;
}

export interface ReferralPaymentDoc {
  _id: string;
  agentId: string;
  referralId: string;
  direction: 'sent' | 'received';
  amount: number;
  date: string;
  mode: 'cash' | 'upi' | 'bank' | 'cheque' | 'adjustment' | 'legacy';
  reference: string;
  note: string;
  clientRequestId?: string;
  source: 'manual' | 'migration';
  voidedAt?: string | null;
  voidReason: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyDoc {
  _id: string;
  agentId: string;
  name: string;
  normalizedName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyPremiumSummaryRow {
  companyId: string | null;
  companyName: string;
  policyCount: number;
  totalPremium: number;
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

export async function getCompanies(): Promise<{ companies: CompanyDoc[] }> {
  const res = await fetch('/api/companies');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to fetch companies');
  }
  return res.json();
}

export async function createCompany(
  data: { name: string }
): Promise<CompanyDoc> {
  const res = await fetch('/api/companies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to create company');
  }
  return res.json();
}

export async function getCompanyPremiumSummary(filters: {
  from?: string;
  to?: string;
} = {}): Promise<{ rows: CompanyPremiumSummaryRow[] }> {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);

  const res = await fetch(`/api/companies/premium-summary?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to fetch company premium summary');
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
  policies: Array<CustomerDoc & { commissionAmount: number; commissionBase: number }>;
  payments: ReferralPaymentDoc[];
  summary: {
    totalPolicies: number;
    totalCommission: number;
    premiumPaidByAgency: number;
    paymentSentToReferral: number;
    paymentReceivedFromReferral: number;
    balance: number;
    balanceDirection: 'agency_pays' | 'referral_pays' | 'settled';
    amountDue: number;
  };
  policyStatuses: Array<{
    _id: string;
    status: 'settled' | 'partial' | 'pending';
    policyNet: number;
    cumulativeNet: number;
  }>;
}> {
  const res = await fetch(`/api/referrals/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to fetch referral detail');
  }
  return res.json();
}

export async function deleteReferral(
  id: string
): Promise<{ message: string }> {
  const res = await fetch(`/api/referrals/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to delete referral');
  }
  return res.json();
}

export async function getReferralPayments(
  referralId: string,
  filters: { from?: string; to?: string; page?: number; limit?: number } = {}
): Promise<{ payments: ReferralPaymentDoc[]; total: number; page: number; totalPages: number }> {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  const res = await fetch(`/api/referrals/${referralId}/payments?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to fetch payments');
  }
  return res.json();
}

export async function createReferralPayment(
  referralId: string,
  data: {
    direction: 'sent' | 'received';
    amount: number;
    date: string;
    mode: string;
    reference?: string;
    note?: string;
    expectedBalance?: number;
    clientRequestId?: string;
  }
): Promise<{ payment: ReferralPaymentDoc; currentBalance: number; warning?: string }> {
  const res = await fetch(`/api/referrals/${referralId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (data.code === 'BALANCE_CHANGED') {
      const err = new Error('Balance has changed. Please review.') as Error & { code: string; currentBalance: number };
      err.code = 'BALANCE_CHANGED';
      err.currentBalance = data.currentBalance;
      throw err;
    }
    throw new Error(data.error ?? 'Failed to record payment');
  }
  return res.json();
}

export async function editReferralPayment(
  referralId: string,
  paymentId: string,
  data: { date?: string; mode?: string; reference?: string; note?: string }
): Promise<ReferralPaymentDoc> {
  const res = await fetch(`/api/referrals/${referralId}/payments/${paymentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to edit payment');
  }
  return res.json();
}

export async function voidReferralPayment(
  referralId: string,
  paymentId: string,
  reason: string
): Promise<{ payment: ReferralPaymentDoc; currentBalance: number }> {
  const res = await fetch(`/api/referrals/${referralId}/payments/${paymentId}/void`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to void payment');
  }
  return res.json();
}
