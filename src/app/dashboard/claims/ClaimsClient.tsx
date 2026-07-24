"use client";
import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { Search, Plus, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface ClaimType {
  _id: string;
  claimNumber: string;
  claimDate: string;
  claimAmount: string;
  settledAmount: string;
  status: string;
  customerId: {
    _id: string;
    customerName: string;
    policyNumber: string;
    type: string;
  };
}

export default function ClaimsClient() {
  const [claims, setClaims] = useState<ClaimType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  async function loadClaims(p = 1) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/claims?page=${p}&limit=20&search=${encodeURIComponent(search)}&status=${status}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load claims");
      setClaims(data.claims);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClaims(1);
  }, [status]); // Reload when status changes

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    loadClaims(1);
  }

  const statusColors: Record<string, string> = {
    'Filed': '#0F4C81',
    'Under Review': '#b45309',
    'Approved': '#1a7d3e',
    'Settled': '#534AB7',
    'Rejected': '#c0392b',
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Claims</h1>
          <p>Track and manage insurance claims</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link href="/dashboard/claims/new" className="btn btn-primary">
            <Plus size={16} /> New Claim
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: '16px' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px', display: 'flex', gap: '8px' }}>
              <input
                className="form-control"
                placeholder="Search claim # or description..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <button type="submit" className="btn btn-ghost">
                <Search size={16} />
              </button>
            </div>
            <select
              className="form-control"
              style={{ width: '200px' }}
              value={status}
              onChange={e => setStatus(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="Filed">Filed</option>
              <option value="Under Review">Under Review</option>
              <option value="Approved">Approved</option>
              <option value="Settled">Settled</option>
              <option value="Rejected">Rejected</option>
            </select>
          </form>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ padding: 40, color: "var(--text-muted)", textAlign: "center" }}>Loading claims…</div>
      ) : claims.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '20px', borderRadius: '50%', marginBottom: '16px' }}>
            <FileText size={40} />
          </div>
          <h3 style={{ marginBottom: '8px' }}>No claims found</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
            {search || status !== 'all' ? "Try adjusting your filters" : "You haven't added any claims yet"}
          </p>
          {(!search && status === 'all') && (
            <Link href="/dashboard/claims/new" className="btn btn-primary">
              Create First Claim
            </Link>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Claim #</th>
                  <th>Customer</th>
                  <th>Policy #</th>
                  <th>Claim Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <Link href={`/dashboard/claims/${c._id}`} className="td-name" style={{ fontWeight: 600 }}>
                        {c.claimNumber}
                      </Link>
                    </td>
                    <td>{c.customerId?.customerName || "—"}</td>
                    <td>
                      <div>{c.customerId?.policyNumber || "—"}</div>
                      {c.customerId?.type && (
                        <span className="badge" style={{ marginTop: 4, background: `var(--${c.customerId.type}-bg)`, color: `var(--${c.customerId.type})`, border: `1px solid var(--${c.customerId.type}-border)` }}>
                          {c.customerId.type}
                        </span>
                      )}
                    </td>
                    <td>{formatDate(c.claimDate)}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{formatCurrency(c.claimAmount)}</div>
                      {c.settledAmount && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Settled: {formatCurrency(c.settledAmount)}</div>}
                    </td>
                    <td>
                      <span className="badge" style={{ backgroundColor: statusColors[c.status] || '#0F4C81', color: 'white' }}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', padding: '16px', borderTop: '1px solid var(--border)' }}>
              <button 
                className="btn btn-ghost btn-sm" 
                onClick={() => loadClaims(page - 1)} 
                disabled={page === 1}
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                Page {page} of {totalPages}
              </span>
              <button 
                className="btn btn-ghost btn-sm" 
                onClick={() => loadClaims(page + 1)} 
                disabled={page === totalPages}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
