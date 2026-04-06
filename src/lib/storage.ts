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
  type: 'motor' | 'medical' | 'fire' | 'life';
  customerName: string;
  phone: string;
  email: string;
  address: string;
  policyNumber: string;
  premiumAmount: string;
  sumInsured: string;
  startDate: string;
  endDate: string;
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
