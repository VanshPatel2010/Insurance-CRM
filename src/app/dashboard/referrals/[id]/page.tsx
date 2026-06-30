"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, X } from "lucide-react";
import PolicyBadge from "@/components/PolicyBadge";
import {
  getReferralDetail,
  ReferralMemberDoc,
  updateReferralCommissions,
} from "@/lib/storage";
import { formatCurrency, formatDate } from "@/lib/utils";
import { summarizeReferralPolicies } from "@/lib/referralMath";

type PolicyRow = Awaited<ReturnType<typeof getReferralDetail>>["policies"][number];

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function moneyNumber(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function policyNetAmount(policy: PolicyRow) {
  return (
    moneyNumber(policy.premiumPaidByAgency) -
    (policy.commissionStatus === "Paid" ? 0 : policy.commissionAmount) -
    moneyNumber(policy.paymentReceivedFromReferral) +
    moneyNumber(policy.paymentSentToReferral)
  );
}

export default function ReferralDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [referral, setReferral] = useState<ReferralMemberDoc | null>(null);
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [updatingPolicyIds, setUpdatingPolicyIds] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await getReferralDetail(id);
      setReferral(data.referral);
      setPolicies(data.policies);
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
  const reportSummary = useMemo(
    () => ({
      ...summarizeReferralPolicies(reportPolicies),
      totalReferred: reportPolicies.length,
    }),
    [reportPolicies],
  );

  async function toggleCommissionStatus(policyId: string, checked: boolean) {
    setUpdatingPolicyIds((ids) => [...ids, policyId]);
    setPolicies((current) =>
      current.map((policy) =>
        policy._id === policyId
          ? { ...policy, commissionStatus: checked ? "Paid" : "Pending" }
          : policy,
      ),
    );
    try {
      await updateReferralCommissions(id, [policyId], checked ? "Paid" : "Pending");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update commission status");
      await load();
    } finally {
      setUpdatingPolicyIds((ids) => ids.filter((item) => item !== policyId));
    }
  }

  function downloadCsv() {
    const header = [
      "Policy Number",
      "Policyholder Name",
      "Policy Type",
      "Premium Amount",
      "Premium Without GST",
      "Commission Base",
      "Agent Code",
      "Commission %",
      "Commission Amount",
      "Premium Paid By Agency",
      "Payment Received From Referral",
      "Payment Sent To Referral",
      "Net Amount",
      "Policy Date",
    ];
    const rows = reportPolicies.map((policy) => [
      policy.policyNumber,
      policy.customerName,
      policy.type,
      policy.premiumAmount,
      policy.premiumWithoutGst,
      policy.commissionBase,
      policy.referralAgentCode,
      policy.commissionType === "percentage" ? policy.commissionValue : "",
      policy.commissionAmount,
      policy.premiumPaidByAgency,
      policy.paymentReceivedFromReferral,
      policy.paymentSentToReferral,
      policyNetAmount(policy),
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
        <div className="stat-card"><div className="stat-card-value">{reportSummary.totalReferred}</div><div className="stat-card-label">Total Referred</div></div>
        <div className="stat-card"><div className="stat-card-value">{formatCurrency(reportSummary.totalCommission)}</div><div className="stat-card-label">Total Commission</div></div>
        <div className="stat-card"><div className="stat-card-value">{formatCurrency(reportSummary.pendingCommission)}</div><div className="stat-card-label">Pending</div></div>
        <div className="stat-card"><div className="stat-card-value">{formatCurrency(reportSummary.paidCommission)}</div><div className="stat-card-label">Paid</div></div>
        <div className="stat-card"><div className="stat-card-value">{formatCurrency(reportSummary.netAmount)}</div><div className="stat-card-label">Net Amount</div></div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card"><div className="stat-card-value">{formatCurrency(reportSummary.premiumPaidByAgency)}</div><div className="stat-card-label">Agency Paid Premium</div></div>
        <div className="stat-card"><div className="stat-card-value">{formatCurrency(reportSummary.paymentReceivedFromReferral)}</div><div className="stat-card-label">Received From Referral</div></div>
        <div className="stat-card"><div className="stat-card-value">{formatCurrency(reportSummary.paymentSentToReferral)}</div><div className="stat-card-label">Sent To Referral</div></div>
      </div>

      <div className="filter-bar">
        <input className="form-control" style={{ maxWidth: 180 }} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <input className="form-control" style={{ maxWidth: 180 }} type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        {(fromDate || toDate) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setFromDate("");
              setToDate("");
            }}
          >
            <X size={14} /> Clear
          </button>
        )}
        <button className="btn btn-outline btn-sm" onClick={downloadCsv}>
          <Download size={14} /> Download Report
        </button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Paid</th>
              <th>Policyholder</th>
              <th>Policy Type</th>
              <th>Policy Number</th>
              <th>Premium</th>
              <th>Commission Base</th>
              <th>Agent Code</th>
              <th>Commission</th>
              <th>Payments</th>
              <th>Net</th>
              <th>Status</th>
              <th>Policy Date</th>
            </tr>
          </thead>
          <tbody>
            {reportPolicies.map((policy) => (
              <tr key={policy._id}>
                <td>
                  <input
                    aria-label={`Mark commission ${policy.commissionStatus === "Paid" ? "pending" : "paid"} for ${policy.customerName}`}
                    type="checkbox"
                    checked={policy.commissionStatus === "Paid"}
                    disabled={updatingPolicyIds.includes(policy._id)}
                    onChange={(e) =>
                      toggleCommissionStatus(policy._id, e.target.checked)
                    }
                  />
                </td>
                <td>{policy.customerName}</td>
                <td><PolicyBadge type={policy.type} /></td>
                <td style={{ fontFamily: "monospace", fontSize: 13 }}>{policy.policyNumber}</td>
                <td>
                  <div>{formatCurrency(policy.premiumAmount)}</div>
                  <div className="td-muted">Net {formatCurrency(policy.premiumWithoutGst ?? policy.premiumAmount)}</div>
                </td>
                <td>{formatCurrency(policy.commissionBase)}</td>
                <td>{policy.referralAgentCode || "—"}</td>
                <td>
                  <div>{policy.commissionType === "flat" ? "Flat" : `${policy.commissionValue || 0}%`}</div>
                  <div className="td-muted">{formatCurrency(policy.commissionAmount)}</div>
                </td>
                <td>
                  <div>Agency {formatCurrency(policy.premiumPaidByAgency ?? 0)}</div>
                  <div className="td-muted">Received {formatCurrency(policy.paymentReceivedFromReferral ?? 0)}</div>
                  <div className="td-muted">Sent {formatCurrency(policy.paymentSentToReferral ?? 0)}</div>
                </td>
                <td>
                  {formatCurrency(policyNetAmount(policy))}
                </td>
                <td>{policy.commissionStatus || "Pending"}</td>
                <td>{formatDate(policy.startDate)}</td>
              </tr>
            ))}
            {reportPolicies.length === 0 && (
              <tr>
                <td colSpan={12} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                  No policies found for this date range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
