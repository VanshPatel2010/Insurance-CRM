"use client";
import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Save } from "lucide-react";

interface CustomerOption {
  _id: string;
  customerName: string;
  policyNumber: string;
}

export default function NewClaimPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customersLoading, setCustomersLoading] = useState(true);

  const [form, setForm] = useState({
    customerId: "",
    claimNumber: "",
    claimDate: new Date().toISOString().split('T')[0],
    description: "",
    claimAmount: "",
    status: "Filed"
  });

  useEffect(() => {
    async function fetchCustomers() {
      try {
        const res = await fetch('/api/customers?limit=1000');
        const data = await res.json();
        if (res.ok && data.customers) {
          setCustomers(data.customers);
        }
      } catch (err) {
        console.error("Failed to fetch customers", err);
      } finally {
        setCustomersLoading(false);
      }
    }
    fetchCustomers();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.customerId || !form.claimNumber || !form.claimDate || !form.claimAmount) {
      setError("Please fill in all required fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to create claim");
      
      router.push("/dashboard/claims");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating claim");
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/dashboard/claims" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', textDecoration: 'none', fontSize: '14px' }}>
          <ChevronLeft size={16} /> Back to Claims
        </Link>
      </div>

      <div className="page-header">
        <div className="page-header-left">
          <h1>New Claim</h1>
          <p>Register a new insurance claim</p>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

      <form className="card" onSubmit={handleSubmit}>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="customer">Customer / Policy *</label>
              <select 
                id="customer"
                className="form-control" 
                value={form.customerId}
                onChange={e => setForm({...form, customerId: e.target.value})}
                required
                disabled={customersLoading}
              >
                <option value="">Select Customer</option>
                {customers.map(c => (
                  <option key={c._id} value={c._id}>
                    {c.customerName} - {c.policyNumber}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label" htmlFor="claimNumber">Claim Number *</label>
              <input 
                id="claimNumber"
                className="form-control" 
                value={form.claimNumber}
                onChange={e => setForm({...form, claimNumber: e.target.value})}
                required
                placeholder="e.g. CLM-2023-001"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="claimDate">Claim Date *</label>
              <input 
                id="claimDate"
                type="date"
                className="form-control" 
                value={form.claimDate}
                onChange={e => setForm({...form, claimDate: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="claimAmount">Claim Amount *</label>
              <input 
                id="claimAmount"
                type="number"
                className="form-control" 
                value={form.claimAmount}
                onChange={e => setForm({...form, claimAmount: e.target.value})}
                required
                placeholder="0.00"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label" htmlFor="status">Initial Status</label>
              <select 
                id="status"
                className="form-control" 
                value={form.status}
                onChange={e => setForm({...form, status: e.target.value})}
              >
                <option value="Filed">Filed</option>
                <option value="Under Review">Under Review</option>
                <option value="Approved">Approved</option>
                <option value="Settled">Settled</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label" htmlFor="description">Description / Incident Details</label>
              <textarea 
                id="description"
                className="form-control" 
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
                rows={4}
                placeholder="Describe the incident..."
              />
            </div>
          </div>
        </div>
        
        <div className="card-body" style={{ borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <Link href="/dashboard/claims" className="btn btn-ghost">Cancel</Link>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <Save size={16} /> {loading ? "Saving..." : "Save Claim"}
          </button>
        </div>
      </form>
    </div>
  );
}
