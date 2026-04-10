'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getAllCustomers, deleteCustomer, CustomerDoc } from '@/lib/storage';
import { getStatus, formatCurrency, formatDate } from '@/lib/utils';
import { PolicyType } from '@/lib/types';
import PolicyBadge from '@/components/PolicyBadge';
import StatusBadge from '@/components/StatusBadge';
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

type FilterType   = 'all' | PolicyType;
type FilterStatus = 'all' | 'Active' | 'Expired' | 'Expiring Soon';

export default function CustomersContent() {
  const searchParams = useSearchParams();

  const [customers,    setCustomers]    = useState<CustomerDoc[]>([]);
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(1);
  const [totalPages,  setTotalPages]   = useState(1);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [search,       setSearch]       = useState('');
  const [typeFilter,   setTypeFilter]   = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>(
    searchParams.get('filter') === 'expiring' ? 'Expiring Soon' : 'all'
  );
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Debounce ref
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const fetchCustomers = useCallback(async (opts: {
    search: string; type: string; status: string; page: number;
  }) => {
    setLoading(true);
    setError('');
    try {
      const data = await getAllCustomers({
        search:  opts.search || undefined,
        type:    opts.type   !== 'all' ? opts.type   : undefined,
        status:  opts.status !== 'all' ? opts.status : undefined,
        page:    opts.page,
        limit:   20,
      });
      setCustomers(data.customers);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + filter changes
  useEffect(() => {
    fetchCustomers({ search, type: typeFilter, status: statusFilter, page });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter, page]);

  // Debounced search
  function handleSearchChange(val: string) {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchCustomers({ search: val, type: typeFilter, status: statusFilter, page: 1 });
    }, 300);
  }

  async function handleDelete(id: string) {
    setDeleteLoading(true);
    try {
      await deleteCustomer(id);
      setDeleteConfirm(null);
      // Re-fetch current page (adjust if last item on page)
      const newPage = customers.length === 1 && page > 1 ? page - 1 : page;
      setPage(newPage);
      fetchCustomers({ search, type: typeFilter, status: statusFilter, page: newPage });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete customer');
    } finally {
      setDeleteLoading(false);
    }
  }

  function clearFilters() {
    setSearch('');
    setTypeFilter('all');
    setStatusFilter('all');
    setPage(1);
    fetchCustomers({ search: '', type: 'all', status: 'all', page: 1 });
  }

  const hasFilters = search || typeFilter !== 'all' || statusFilter !== 'all';

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Customers</h1>
          <p>{total} total customer{total !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/dashboard/customers/new" className="btn btn-primary">
          <Plus size={16} /> Add New Customer
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by name, phone, or policy number…"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            id="customer-search"
          />
        </div>

        <select
          className="filter-select"
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value as FilterType); setPage(1); }}
          id="type-filter"
        >
          <option value="all">All Types</option>
          <option value="motor">Motor</option>
          <option value="medical">Medical</option>
          <option value="fire">Fire</option>
          <option value="life">Life</option>
          <option value="personal-accident">Personal Accident</option>
          <option value="marine">Marine Insurance</option>
          <option value="workman-compensation">Workman Compensation</option>
        </select>

        <select
          className="filter-select"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value as FilterStatus); setPage(1); }}
          id="status-filter"
        >
          <option value="all">All Status</option>
          <option value="Active">Active</option>
          <option value="Expiring Soon">Expiring Soon</option>
          <option value="Expired">Expired</option>
        </select>

        {hasFilters && (
          <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading customers…
        </div>
      ) : customers.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🔍</div>
            <h3>{total === 0 && !hasFilters ? 'No customers yet' : 'No results found'}</h3>
            <p>
              {total === 0 && !hasFilters
                ? 'Add your first customer policy to get started.'
                : 'Try adjusting your search or filter criteria.'}
            </p>
            {total === 0 && !hasFilters && (
              <Link href="/dashboard/customers/new" className="btn btn-primary btn-sm" style={{ marginTop: 14 }}>
                <Plus size={14} /> Add Customer
              </Link>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Policy Number</th>
                  <th>Premium</th>
                  <th>Expiry Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(p => {
                  const status = getStatus(p.endDate);
                  return (
                    <tr key={p._id}>
                      <td>
                        <div className="td-name">{p.customerName}</div>
                        <div className="td-muted">{p.phone}</div>
                      </td>
                      <td><PolicyBadge type={p.type} /></td>
                      <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{p.policyNumber || '—'}</td>
                      <td>{formatCurrency(p.premiumAmount)}</td>
                      <td>
                        {formatDate(p.endDate)}
                        {status === 'Expiring Soon' && (
                          <span style={{ display: 'block', fontSize: 11, color: 'var(--fire)', marginTop: 2, fontWeight: 600 }}>
                            <AlertTriangle size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                            Expiring soon
                          </span>
                        )}
                      </td>
                      <td><StatusBadge status={status} /></td>
                      <td>
                        <div className="td-actions">
                          <Link href={`/dashboard/customers/${p._id}`} className="btn btn-sm btn-ghost" title="View">
                            <Eye size={13} />
                          </Link>
                          <Link href={`/dashboard/customers/new?id=${p._id}`} className="btn btn-sm btn-outline" title="Edit">
                            <Pencil size={13} />
                          </Link>
                          <button
                            className="btn btn-sm btn-danger"
                            title="Delete"
                            onClick={() => setDeleteConfirm(p._id)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16 }}>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Page {page} of {totalPages}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="confirm-overlay" onClick={() => !deleteLoading && setDeleteConfirm(null)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <h3>Delete Customer?</h3>
            <p>
              This will permanently remove the customer record and all policy information. This action cannot be undone.
            </p>
            {error && <p style={{ color: 'var(--status-expired)', fontSize: 13 }}>{error}</p>}
            <div className="confirm-actions">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)} disabled={deleteLoading}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ background: 'var(--status-expired)' }}
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleteLoading}
              >
                <Trash2 size={14} /> {deleteLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
