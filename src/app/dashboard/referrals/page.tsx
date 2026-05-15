"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";
import { createReferral, getReferrals, ReferralMemberDoc } from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<ReferralMemberDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "" });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await getReferrals();
      setReferrals(data.referrals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load referrals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await createReferral(form);
      setForm({ name: "", phone: "", email: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create referral");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Referrals</h1>
          <p>Referral members and commission totals</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <form className="card" onSubmit={handleCreate} style={{ marginBottom: 20 }}>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="ref-name">Name</label>
              <input id="ref-name" className="form-control" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Referral member name" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ref-phone">Contact</label>
              <input id="ref-phone" className="form-control" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Phone number" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ref-email">Email</label>
              <input id="ref-email" className="form-control" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
            </div>
            <div className="form-group" style={{ justifyContent: "end" }}>
              <button className="btn btn-primary" disabled={saving || !form.name.trim()}>
                <Plus size={15} /> Add Referral
              </button>
            </div>
          </div>
        </div>
      </form>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
      {loading ? (
        <div style={{ padding: 40, color: "var(--text-muted)" }}>Loading referrals…</div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact Info</th>
                <th>Total Policies</th>
                <th>Total Commission</th>
                <th>Pending</th>
                <th>Paid</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((person) => (
                <tr key={person._id}>
                  <td>
                    <Link className="td-name" href={`/dashboard/referrals/${person._id}`}>
                      {person.name}
                    </Link>
                  </td>
                  <td>
                    <div>{person.phone || "—"}</div>
                    <div className="td-muted">{person.email || "—"}</div>
                  </td>
                  <td>{person.totalPolicies ?? 0}</td>
                  <td>{formatCurrency(person.totalCommission ?? 0)}</td>
                  <td>{formatCurrency(person.pendingCommission ?? 0)}</td>
                  <td>{formatCurrency(person.paidCommission ?? 0)}</td>
                </tr>
              ))}
              {referrals.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                    No referral members yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
