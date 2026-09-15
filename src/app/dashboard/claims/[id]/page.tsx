"use client";
import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Save, Trash2, Clock, FileText, User } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function ClaimDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [claim, setClaim] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  
  // Edit form state
  const [status, setStatus] = useState("");
  const [settledAmount, setSettledAmount] = useState("");
  const [newNote, setNewNote] = useState("");

  useEffect(() => {
    async function fetchClaim() {
      try {
        const res = await fetch(`/api/claims/${params.id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load claim");
        setClaim(data);
        setStatus(data.status);
        setSettledAmount(data.settledAmount || "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      } finally {
        setLoading(false);
      }
    }
    fetchClaim();
  }, [params.id]);

  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/claims/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, settledAmount })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update claim");
      setClaim(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating claim");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddNote(e: FormEvent) {
    e.preventDefault();
    if (!newNote.trim()) return;
    setSaving(true);
    
    try {
      const res = await fetch(`/api/claims/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newNote })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add note");
      setClaim(data);
      setNewNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error adding note");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this claim?")) return;
    try {
      const res = await fetch(`/api/claims/${params.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete claim");
      router.push("/dashboard/claims");
      router.refresh();
    } catch (err) {
      alert("Failed to delete claim");
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>;
  if (error || !claim) return <div className="alert alert-danger">{error || "Claim not found"}</div>;

  const statusColors: Record<string, string> = {
    'Filed': '#0F4C81',
    'Under Review': '#b45309',
    'Approved': '#1a7d3e',
    'Settled': '#534AB7',
    'Rejected': '#c0392b',
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/dashboard/claims" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', textDecoration: 'none', fontSize: '14px' }}>
          <ChevronLeft size={16} /> Back to Claims
        </Link>
      </div>

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <h1 style={{ margin: 0 }}>Claim {claim.claimNumber}</h1>
            <span className="badge" style={{ backgroundColor: statusColors[claim.status] || '#0F4C81', color: 'white', fontSize: '14px', padding: '4px 10px' }}>
              {claim.status}
            </span>
          </div>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Filed on {formatDate(claim.claimDate)}</p>
        </div>
        <button onClick={handleDelete} className="btn btn-ghost" style={{ color: 'var(--status-expired)' }}>
          <Trash2 size={16} /> Delete
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Claim Details Card */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Claim Details</h2>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>Claim Amount</div>
                  <div style={{ fontSize: '20px', fontWeight: 600 }}>{formatCurrency(claim.claimAmount)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>Settled Amount</div>
                  <div style={{ fontSize: '20px', fontWeight: 600 }}>{claim.settledAmount ? formatCurrency(claim.settledAmount) : '—'}</div>
                </div>
              </div>
              
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '8px' }}>Description</div>
                <div style={{ backgroundColor: 'var(--surface-alt)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', whiteSpace: 'pre-wrap' }}>
                  {claim.description || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No description provided.</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Timeline & Notes</h2>
            </div>
            <div className="card-body">
              <form onSubmit={handleAddNote} style={{ marginBottom: '24px', display: 'flex', gap: '12px' }}>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ flex: 1 }}
                  placeholder="Add a note..." 
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                />
                <button type="submit" className="btn btn-primary" disabled={saving || !newNote.trim()}>
                  Add
                </button>
              </form>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {claim.notes && claim.notes.length > 0 ? (
                  claim.notes.slice().reverse().map((note: any, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Clock size={14} />
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          {formatDate(note.createdAt)} at {new Date(note.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                        <div style={{ backgroundColor: 'var(--surface-alt)', padding: '12px 16px', borderRadius: '0 var(--radius-sm) var(--radius-sm) var(--radius-sm)', border: '1px solid var(--border)' }}>
                          {note.text}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No notes yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Update Status Card */}
          <form className="card" onSubmit={handleUpdate}>
            <div className="card-header">
              <h2 className="card-title">Update Status</h2>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Status</label>
                <select 
                  className="form-control" 
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                >
                  <option value="Filed">Filed</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Approved">Approved</option>
                  <option value="Settled">Settled</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Settled Amount</label>
                <input 
                  type="number"
                  className="form-control" 
                  value={settledAmount}
                  onChange={e => setSettledAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={saving}>
                <Save size={16} /> Save Changes
              </button>
            </div>
          </form>

          {/* Linked Policy Info */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Linked Policy</h2>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--surface-alt)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={20} color="var(--text-muted)" />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '15px' }}>{claim.customerId?.customerName}</div>
                  <Link href={`/dashboard/customers/${claim.customerId?._id}`} style={{ fontSize: '13px', color: 'var(--primary)', textDecoration: 'none' }}>
                    View Customer
                  </Link>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Policy Number</div>
                  <div style={{ fontWeight: 500 }}>{claim.customerId?.policyNumber}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Insurance Type</div>
                  {claim.customerId?.type && (
                    <div style={{ marginTop: '4px' }}>
                      <span className="badge" style={{ background: `var(--${claim.customerId.type}-bg)`, color: `var(--${claim.customerId.type})`, border: `1px solid var(--${claim.customerId.type}-border)` }}>
                        {claim.customerId.type}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
