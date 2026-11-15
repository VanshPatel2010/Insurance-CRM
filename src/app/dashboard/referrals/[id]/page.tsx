"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, X, Plus, Edit, Ban, ChevronLeft, ChevronRight } from "lucide-react";
import PolicyBadge from "@/components/PolicyBadge";
import {
  getReferralDetail,
  createReferralPayment,
  editReferralPayment,
  voidReferralPayment,
  ReferralMemberDoc,
  ReferralPaymentDoc,
} from "@/lib/storage";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  commissionAmount as calcCommission,
  toMoneyNumber,
  round2,
  isSettled,
  type PolicyWithStatus,
} from "@/lib/referralMath";

type PolicyRow = Awaited<ReturnType<typeof getReferralDetail>>["policies"][number];

// ── Helpers ─────────────────────────────────────────────────────────────────────

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

const MODE_LABELS: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  bank: "Bank Transfer",
  cheque: "Cheque",
  adjustment: "Adjustment",
  legacy: "Legacy",
};

// ── Main Component ──────────────────────────────────────────────────────────────

export default function ReferralDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [referral, setReferral] = useState<ReferralMemberDoc | null>(null);
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [payments, setPayments] = useState<ReferralPaymentDoc[]>([]);
  const [policyStatuses, setPolicyStatuses] = useState<PolicyWithStatus[]>([]);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getReferralDetail>>["summary"] | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Payment dialog state
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [payDirection, setPayDirection] = useState<"sent" | "received">("sent");
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [payMode, setPayMode] = useState("cash");
  const [payReference, setPayReference] = useState("");
  const [payNote, setPayNote] = useState("");
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState("");
  const [payClientId, setPayClientId] = useState("");

  // Edit dialog state
  const [editPayment, setEditPayment] = useState<ReferralPaymentDoc | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editMode, setEditMode] = useState("");
  const [editReference, setEditReference] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Void dialog state
  const [voidPayment, setVoidPayment] = useState<ReferralPaymentDoc | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidSubmitting, setVoidSubmitting] = useState(false);

  // Payment pagination
  const [paymentPage, setPaymentPage] = useState(1);
  const paymentsPerPage = 20;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await getReferralDetail(id);
      setReferral(data.referral);
      setPolicies(data.policies);
      setPayments(data.payments);
      setSummary(data.summary);
      setPolicyStatuses(data.policyStatuses);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load referral");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  // ── Filtered policies ───────────────────────────────────────────────────────
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

  // ── Status map for quick lookup ─────────────────────────────────────────────
  const statusMap = useMemo(() => {
    const map = new Map<string, PolicyWithStatus>();
    for (const ps of policyStatuses) map.set(ps._id, ps);
    return map;
  }, [policyStatuses]);

  // ── Paginated payments ──────────────────────────────────────────────────────
  const paginatedPayments = useMemo(() => {
    const start = (paymentPage - 1) * paymentsPerPage;
    return payments.slice(start, start + paymentsPerPage);
  }, [payments, paymentPage]);
  const paymentTotalPages = Math.max(1, Math.ceil(payments.length / paymentsPerPage));

  // ── Open payment dialog ─────────────────────────────────────────────────────
  function openPayDialog() {
    if (summary) {
      setPayDirection(summary.balanceDirection === "referral_pays" ? "received" : "sent");
      setPayAmount(String(summary.amountDue || ""));
    } else {
      setPayDirection("sent");
      setPayAmount("");
    }
    setPayDate(new Date().toISOString().split("T")[0]);
    setPayMode("cash");
    setPayReference("");
    setPayNote("");
    setPayError("");
    setPayClientId(crypto.randomUUID());
    setShowPayDialog(true);
  }

  // ── Payment balance preview ─────────────────────────────────────────────────
  const payAmountNum = Number(payAmount) || 0;
  const previewBalance = summary
    ? round2(summary.balance + (payDirection === "sent" ? -payAmountNum : payAmountNum))
    : 0;
  const isOverpayment =
    summary &&
    payAmountNum > 0 &&
    ((summary.balance > 0.005 && previewBalance < -0.005) ||
      (summary.balance < -0.005 && previewBalance > 0.005));

  async function handleSubmitPayment() {
    if (payAmountNum <= 0) {
      setPayError("Amount must be positive");
      return;
    }
    setPaySubmitting(true);
    setPayError("");
    try {
      await createReferralPayment(id, {
        direction: payDirection,
        amount: payAmountNum,
        date: payDate,
        mode: payMode,
        reference: payReference,
        note: payNote,
        expectedBalance: summary?.balance,
        clientRequestId: payClientId,
      });
      setShowPayDialog(false);
      await load();
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "BALANCE_CHANGED") {
        setPayError("Balance has changed. Please close and re-open.");
        await load();
      } else {
        setPayError(e.message || "Failed to record payment");
      }
    } finally {
      setPaySubmitting(false);
    }
  }

  // ── Edit payment handlers ─────────────────────────────────────────────────
  function openEditDialog(payment: ReferralPaymentDoc) {
    setEditPayment(payment);
    setEditDate(payment.date ? new Date(payment.date).toISOString().split("T")[0] : "");
    setEditMode(payment.mode);
    setEditReference(payment.reference || "");
    setEditNote(payment.note || "");
  }

  async function handleEditPayment() {
    if (!editPayment) return;
    setEditSubmitting(true);
    try {
      await editReferralPayment(id, editPayment._id, {
        date: editDate,
        mode: editMode,
        reference: editReference,
        note: editNote,
      });
      setEditPayment(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to edit payment");
    } finally {
      setEditSubmitting(false);
    }
  }

  // ── Void payment handlers ────────────────────────────────────────────────
  async function handleVoidPayment() {
    if (!voidPayment || !voidReason.trim()) return;
    setVoidSubmitting(true);
    try {
      await voidReferralPayment(id, voidPayment._id, voidReason.trim());
      setVoidPayment(null);
      setVoidReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to void payment");
    } finally {
      setVoidSubmitting(false);
    }
  }

  // ── CSV Download ──────────────────────────────────────────────────────────
  function downloadCsv() {
    const header = [
      "Policy Number", "Policyholder Name", "Policy Type", "Premium Amount",
      "Premium Without GST", "Commission Base", "Agent Code", "Commission Amount",
      "Premium Paid By Agency", "Policy Net", "Settlement Status", "Policy Date",
    ];
    const rows = reportPolicies.map((policy) => {
      const ps = statusMap.get(policy._id);
      return [
        policy.policyNumber, policy.customerName, policy.type,
        policy.premiumAmount, policy.premiumWithoutGst ?? policy.premiumAmount,
        policy.commissionBase, policy.referralAgentCode,
        policy.commissionAmount, toMoneyNumber(policy.premiumPaidByAgency),
        ps?.policyNet ?? 0, ps?.status ?? "pending", policy.startDate,
      ];
    });

    // Payment rows
    const payHeader = ["", "Payment Date", "Direction", "Mode", "Reference", "Amount", "Note", "Status"];
    const payRows = payments.map((p) => [
      "", formatDate(p.date), p.direction, MODE_LABELS[p.mode] || p.mode,
      p.reference, p.amount, p.note, p.voidedAt ? "VOIDED" : "Active",
    ]);

    const allRows = [
      [`Referral: ${referral?.name ?? ""}`, `Generated: ${new Date().toLocaleDateString("en-IN")}`],
      [],
      header,
      ...rows,
      [],
      [`Balance: ${summary ? formatCurrency(summary.amountDue) : "₹0"}`, `(${summary?.balanceDirection === "agency_pays" ? "You pay" : summary?.balanceDirection === "referral_pays" ? "They pay" : "Settled"})`],
      [],
      payHeader,
      ...payRows,
    ];
    const csv = allRows.map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${referral?.name ?? "referral"}-ledger-statement.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div style={{ padding: 40, color: "var(--text-muted)" }}>Loading referral…</div>;
  if (error || !referral) return <div className="alert alert-danger">{error || "Referral not found"}</div>;

  return (
    <div>
      {/* ── Header ────────────────────────────────────────────────────── */}
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
        <button className="btn btn-primary btn-sm" onClick={openPayDialog}>
          <Plus size={14} /> Settle / Record Payment
        </button>
      </div>

      {/* ── Stat Cards ───────────────────────────────────────────────── */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card"><div className="stat-card-value">{summary?.totalPolicies ?? 0}</div><div className="stat-card-label">Total Referred</div></div>
        <div className="stat-card"><div className="stat-card-value">{formatCurrency(summary?.totalCommission ?? 0)}</div><div className="stat-card-label">Total Commission</div></div>
        <div className="stat-card"><div className="stat-card-value">{formatCurrency(summary?.premiumPaidByAgency ?? 0)}</div><div className="stat-card-label">Agency Paid Premium</div></div>
        <div className="stat-card"><div className="stat-card-value">{formatCurrency(summary?.paymentSentToReferral ?? 0)}</div><div className="stat-card-label">Sent To Referral</div></div>
        <div className="stat-card"><div className="stat-card-value">{formatCurrency(summary?.paymentReceivedFromReferral ?? 0)}</div><div className="stat-card-label">Received From Referral</div></div>
        <div className="stat-card" style={{
          background: summary?.balanceDirection === "settled"
            ? "var(--status-active-bg, #dcfce7)"
            : summary?.balanceDirection === "agency_pays"
              ? "var(--status-expiring-bg, #fef3c7)"
              : "var(--status-active-bg, #dbeafe)",
          borderColor: summary?.balanceDirection === "settled"
            ? "var(--status-active, green)"
            : summary?.balanceDirection === "agency_pays"
              ? "var(--status-expiring, #d97706)"
              : "var(--primary, #2563eb)",
          borderWidth: 2,
          borderStyle: "solid",
        }}>
          <div className="stat-card-value" style={{
            color: summary?.balanceDirection === "settled"
              ? "var(--status-active, green)"
              : summary?.balanceDirection === "agency_pays"
                ? "var(--status-expiring, #d97706)"
                : "var(--primary, #2563eb)",
          }}>
            {summary?.balanceDirection === "settled"
              ? "Settled ✓"
              : summary?.balanceDirection === "agency_pays"
                ? `You pay ${formatCurrency(summary?.amountDue ?? 0)}`
                : `They pay ${formatCurrency(summary?.amountDue ?? 0)}`}
          </div>
          <div className="stat-card-label">Balance Due</div>
        </div>
      </div>

      {/* ── Date Filters + Download ──────────────────────────────────── */}
      <div className="filter-bar">
        <input className="form-control" style={{ maxWidth: 180 }} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <input className="form-control" style={{ maxWidth: 180 }} type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        {(fromDate || toDate) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setFromDate(""); setToDate(""); }}>
            <X size={14} /> Clear
          </button>
        )}
        <button className="btn btn-outline btn-sm" onClick={downloadCsv}>
          <Download size={14} /> Download Report
        </button>
      </div>

      {/* ── Policy Table ─────────────────────────────────────────────── */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Policyholder</th>
              <th>Policy Type</th>
              <th>Policy Number</th>
              <th>Premium</th>
              <th>Commission Base</th>
              <th>Agent Code</th>
              <th>Commission</th>
              <th>Agency Paid</th>
              <th>Policy Net</th>
              <th>Status</th>
              <th>Policy Date</th>
            </tr>
          </thead>
          <tbody>
            {reportPolicies.map((policy) => {
              const ps = statusMap.get(policy._id);
              const policyNet = ps?.policyNet ?? round2(policy.commissionAmount - toMoneyNumber(policy.premiumPaidByAgency));
              return (
                <tr key={policy._id}>
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
                  <td>{formatCurrency(toMoneyNumber(policy.premiumPaidByAgency))}</td>
                  <td style={{ color: policyNet < -0.005 ? "var(--status-expired, #dc2626)" : undefined }}>
                    {formatCurrency(policyNet)}
                  </td>
                  <td>
                    {ps?.status === "settled" && <span style={{ color: "var(--status-active, green)", fontSize: 12 }}>● Settled</span>}
                    {ps?.status === "partial" && <span style={{ color: "var(--status-expiring, #d97706)", fontSize: 12 }}>◐ Partial</span>}
                    {ps?.status === "pending" && <span style={{ color: "var(--text-muted, #9ca3af)", fontSize: 12 }}>○ Pending</span>}
                    {!ps && <span style={{ color: "var(--text-muted, #9ca3af)", fontSize: 12 }}>○ Pending</span>}
                  </td>
                  <td>{formatDate(policy.startDate)}</td>
                </tr>
              );
            })}
            {reportPolicies.length === 0 && (
              <tr>
                <td colSpan={11} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                  No policies found for this date range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Payment History ──────────────────────────────────────────── */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Payment History</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Direction</th>
                <th>Mode</th>
                <th>Reference</th>
                <th>Amount</th>
                <th>Note</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPayments.map((payment) => {
                const isVoided = !!payment.voidedAt;
                return (
                  <tr key={payment._id} style={isVoided ? { opacity: 0.45, textDecoration: "line-through" } : undefined}>
                    <td>{formatDate(payment.date)}</td>
                    <td>
                      <span style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        background: payment.direction === "sent" ? "var(--primary-bg, #dbeafe)" : "var(--status-active-bg, #dcfce7)",
                        color: payment.direction === "sent" ? "var(--primary, #2563eb)" : "var(--status-active, green)",
                      }}>
                        {payment.direction === "sent" ? "Sent" : "Received"}
                      </span>
                    </td>
                    <td>{MODE_LABELS[payment.mode] || payment.mode}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{payment.reference || "—"}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(payment.amount)}</td>
                    <td>
                      {payment.note || "—"}
                      {isVoided && payment.voidReason && (
                        <div style={{ fontStyle: "italic", fontSize: 11, color: "var(--status-expired, #dc2626)" }}>
                          Voided: {payment.voidReason}
                        </div>
                      )}
                    </td>
                    <td>
                      {!isVoided && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEditDialog(payment)} title="Edit">
                            <Edit size={13} />
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setVoidPayment(payment); setVoidReason(""); }} title="Void" style={{ color: "var(--status-expired, #dc2626)" }}>
                            <Ban size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                    No payments recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {paymentTotalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 10 }}>
            <button className="btn btn-ghost btn-sm" disabled={paymentPage <= 1} onClick={() => setPaymentPage((p) => p - 1)}>
              <ChevronLeft size={14} /> Prev
            </button>
            <span style={{ alignSelf: "center", fontSize: 13 }}>Page {paymentPage} of {paymentTotalPages}</span>
            <button className="btn btn-ghost btn-sm" disabled={paymentPage >= paymentTotalPages} onClick={() => setPaymentPage((p) => p + 1)}>
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
        <p style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
          Settlement status is derived from the payment ledger. Payments can be voided but never deleted.
        </p>
      </div>

      {/* ── Settle / Record Payment Dialog ───────────────────────────── */}
      {showPayDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: 480, maxWidth: "95vw", maxHeight: "90vh", overflow: "auto" }}>
            <div className="card-header"><span className="card-title">Record Payment</span></div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Current balance */}
              <div style={{ padding: 12, borderRadius: 8, background: "var(--surface-secondary, #f8f9fa)", fontSize: 14 }}>
                {summary?.balanceDirection === "settled"
                  ? "✓ Currently settled"
                  : summary?.balanceDirection === "agency_pays"
                    ? `You owe the referral ${formatCurrency(summary?.amountDue ?? 0)}`
                    : `Referral owes you ${formatCurrency(summary?.amountDue ?? 0)}`}
              </div>

              {/* Direction */}
              <div className="form-group">
                <label className="form-label">Direction</label>
                <select className="form-control" value={payDirection} onChange={(e) => setPayDirection(e.target.value as "sent" | "received")}>
                  <option value="sent">Sent (pay referral)</option>
                  <option value="received">Received (collect from referral)</option>
                </select>
              </div>

              {/* Amount */}
              <div className="form-group">
                <label className="form-label">Amount (₹)</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="form-control" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0" style={{ flex: 1 }} />
                  {summary && summary.amountDue > 0 && (
                    <button className="btn btn-outline btn-sm" onClick={() => setPayAmount(String(summary.amountDue))}>
                      Full amount
                    </button>
                  )}
                </div>
              </div>

              {/* Date */}
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-control" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </div>

              {/* Mode */}
              <div className="form-group">
                <label className="form-label">Mode</label>
                <select className="form-control" value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="adjustment">Adjustment / Write-off</option>
                </select>
              </div>

              {/* Reference */}
              <div className="form-group">
                <label className="form-label">Reference (UTR / Cheque No.)</label>
                <input className="form-control" value={payReference} onChange={(e) => setPayReference(e.target.value)} placeholder="Optional" />
              </div>

              {/* Note */}
              <div className="form-group">
                <label className="form-label">Note {payMode === "adjustment" && <span style={{ color: "var(--status-expired)" }}>*</span>}</label>
                <input className="form-control" value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder={payMode === "adjustment" ? "Required for adjustments" : "Optional"} />
              </div>

              {/* Preview */}
              {payAmountNum > 0 && (
                <div style={{ padding: 10, borderRadius: 6, background: "var(--surface-secondary, #f0f0f0)", fontSize: 13 }}>
                  Balance after this payment: <strong>{formatCurrency(previewBalance)}</strong>
                  {isSettled(previewBalance) && " ✓ Settled"}
                </div>
              )}

              {/* Overpayment warning */}
              {isOverpayment && (
                <div style={{ padding: 10, borderRadius: 6, background: "#fef3c7", color: "#92400e", fontSize: 13 }}>
                  ⚠ This overpays by {formatCurrency(Math.abs(previewBalance))}. The balance will flip.
                </div>
              )}

              {payError && <div className="alert alert-danger" style={{ fontSize: 13 }}>{payError}</div>}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                <button className="btn btn-ghost" onClick={() => setShowPayDialog(false)} disabled={paySubmitting}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSubmitPayment} disabled={paySubmitting || payAmountNum <= 0 || (payMode === "adjustment" && !payNote.trim())}>
                  {paySubmitting ? "Recording…" : "Record Payment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Payment Dialog ──────────────────────────────────────── */}
      {editPayment && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: 440, maxWidth: "95vw" }}>
            <div className="card-header"><span className="card-title">Edit Payment</span></div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {editPayment.direction === "sent" ? "Sent" : "Received"} · {formatCurrency(editPayment.amount)} (amount and direction cannot be changed)
              </p>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-control" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Mode</label>
                <select className="form-control" value={editMode} onChange={(e) => setEditMode(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Reference</label>
                <input className="form-control" value={editReference} onChange={(e) => setEditReference(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Note</label>
                <input className="form-control" value={editNote} onChange={(e) => setEditNote(e.target.value)} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => setEditPayment(null)} disabled={editSubmitting}>Cancel</button>
                <button className="btn btn-primary" onClick={handleEditPayment} disabled={editSubmitting}>
                  {editSubmitting ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Void Payment Dialog ──────────────────────────────────────── */}
      {voidPayment && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: 420, maxWidth: "95vw" }}>
            <div className="card-header"><span className="card-title">Void Payment</span></div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: 13 }}>
                Are you sure you want to void this <strong>{voidPayment.direction}</strong> payment of <strong>{formatCurrency(voidPayment.amount)}</strong>?
                This cannot be undone.
              </p>
              <div className="form-group">
                <label className="form-label">Reason *</label>
                <input className="form-control" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Why is this payment being voided?" />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => setVoidPayment(null)} disabled={voidSubmitting}>Cancel</button>
                <button className="btn btn-primary" onClick={handleVoidPayment} disabled={voidSubmitting || !voidReason.trim()} style={{ background: "var(--status-expired, #dc2626)" }}>
                  {voidSubmitting ? "Voiding…" : "Void Payment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
