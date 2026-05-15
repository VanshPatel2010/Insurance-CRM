"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import PolicyBadge from "@/components/PolicyBadge";
import {
  getReferralDetail,
  ReferralMemberDoc,
  updateReferralCommissions,
} from "@/lib/storage";
import { formatCurrency, formatDate } from "@/lib/utils";

type PolicyRow = Awaited<ReturnType<typeof getReferralDetail>>["policies"][number];

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export default function ReferralDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [referral, setReferral] = useState<ReferralMemberDoc | null>(null);
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [summary, setSummary] = useState({
    totalReferred: 0,
    totalCommission: 0,
    pendingCommission: 0,
    paidCommission: 0,
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await getReferralDetail(id);
      setReferral(data.referral);
      setPolicies(data.policies);
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load referral");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  const reportPolicies = useMemo(
    () =>
      policies.filter((policy) => {
        const date = policy.startDate;
        if (fromDate && date < fromDate) return false;
        if (toDate && date > toDate) return false;
        return true;
      }),
    [policies, fromDate, toDate],
  );

  async function markPaid(policyIds: string[]) {
    await updateReferralCommissions(id, policyIds, "Paid");
    setSelected([]);
    await load();
  }

  function downloadCsv() {
    const header = [
      "Policy Number",
      "Policyholder Name",
      "Policy Type",
      "Premium Amount",
      "Commission %",
      "Commission Amount",
      "Policy Date",
    ];
    const rows = reportPolicies.map((policy) => [
      policy.policyNumber,
      policy.customerName,
      policy.type,
      policy.premiumAmount,
      policy.commissionType === "percentage" ? policy.commissionValue : "",
      policy.commissionAmount,
      policy.startDate,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${referral?.name ?? "referral"}-commission-statement.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div style={{ padding: 40, color: "var(--text-muted)" }}>Loading referral…</div>;
  if (error || !referral) return <div className="alert alert-danger">{error || "Referral not found"}</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left" style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Link href="/dashboard/referrals" className="btn btn-ghost btn-sm">
            <ArrowLeft size={15} /> Back
          </Link>
          <div>
            <h1>{referral.name}</h1>
            <p>{referral.phone || "No phone"} · {referral.email || "No email"}</p>
          </div>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card"><div className="stat-card-value">{summary.totalReferred}</div><div className="stat-card-label">Total Referred</div></div>
        <div className="stat-card"><div className="stat-card-value">{formatCurrency(summary.totalCommission)}</div><div className="stat-card-label">Total Commission</div></div>
        <div className="stat-card"><div className="stat-card-value">{formatCurrency(summary.pendingCommission)}</div><div className="stat-card-label">Pending</div></div>
        <div className="stat-card"><div className="stat-card-value">{formatCurrency(summary.paidCommission)}</div><div className="stat-card-label">Paid</div></div>
      </div>

      <div className="filter-bar">
        <input className="form-control" style={{ maxWidth: 180 }} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <input className="form-control" style={{ maxWidth: 180 }} type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        <button className="btn btn-outline btn-sm" onClick={downloadCsv}>
          <Download size={14} /> Download Report
        </button>
        <button className="btn btn-primary btn-sm" disabled={selected.length === 0} onClick={() => markPaid(selected)}>
          Mark Selected Paid
        </button>
        <button className="btn btn-ghost btn-sm" disabled={!policies.some((p) => p.commissionStatus !== "Paid")} onClick={() => markPaid([])}>
          Mark All Paid
        </button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" checked={selected.length === policies.length && policies.length > 0} onChange={(e) => setSelected(e.target.checked ? policies.map((p) => p._id) : [])} /></th>
              <th>Policyholder</th>
              <th>Policy Type</th>
              <th>Policy Number</th>
              <th>Premium</th>
              <th>Commission</th>
              <th>Status</th>
              <th>Policy Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((policy) => (
              <tr key={policy._id}>
                <td><input type="checkbox" checked={selected.includes(policy._id)} onChange={(e) => setSelected((ids) => e.target.checked ? [...ids, policy._id] : ids.filter((item) => item !== policy._id))} /></td>
                <td>{policy.customerName}</td>
                <td><PolicyBadge type={policy.type} /></td>
                <td style={{ fontFamily: "monospace", fontSize: 13 }}>{policy.policyNumber}</td>
                <td>{formatCurrency(policy.premiumAmount)}</td>
                <td>
                  <div>{policy.commissionType === "flat" ? "Flat" : `${policy.commissionValue || 0}%`}</div>
                  <div className="td-muted">{formatCurrency(policy.commissionAmount)}</div>
                </td>
                <td>{policy.commissionStatus || "Pending"}</td>
                <td>{formatDate(policy.startDate)}</td>
                <td>
                  <button className="btn btn-ghost btn-sm" disabled={policy.commissionStatus === "Paid"} onClick={() => markPaid([policy._id])}>
                    Mark Paid
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
