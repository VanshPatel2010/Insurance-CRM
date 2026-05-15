"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import PolicyBadge from "@/components/PolicyBadge";
import StatusBadge from "@/components/StatusBadge";
import { CustomerDoc, FamilyGroupDoc, getFamilyGroupDetail } from "@/lib/storage";
import { formatCurrency, formatDate, getStatus } from "@/lib/utils";

export default function FamilyGroupPage() {
  const params = useParams();
  const id = params.id as string;
  const [familyGroup, setFamilyGroup] = useState<FamilyGroupDoc | null>(null);
  const [policies, setPolicies] = useState<CustomerDoc[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFamilyGroupDetail(id)
      .then((data) => {
        setFamilyGroup(data.familyGroup);
        setPolicies(data.policies);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load family"))
      .finally(() => setLoading(false));
  }, [id]);

  const totalPremium = policies.reduce(
    (sum, policy) =>
      sum + (Number(String(policy.premiumAmount ?? "0").replace(/[^0-9.-]/g, "")) || 0),
    0,
  );
  const alerts = policies.filter((policy) => getStatus(policy.endDate) === "Expiring Soon").length;

  if (loading) return <div style={{ padding: 40, color: "var(--text-muted)" }}>Loading family…</div>;
  if (error || !familyGroup) {
    return (
      <div className="alert alert-danger">
        <AlertTriangle size={16} /> {error || "Family not found"}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left" style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Link href="/dashboard/customers" className="btn btn-ghost btn-sm">
            <ArrowLeft size={15} /> Back
          </Link>
          <div>
            <h1>{familyGroup.familyName}</h1>
            <p>Primary policyholder: {familyGroup.primaryPolicyholderName}</p>
          </div>
        </div>
        <Link href="/dashboard/customers/new" className="btn btn-primary">
          Add Policy
        </Link>
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-card-value">{policies.length}</div>
          <div className="stat-card-label">Total Policies</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{formatCurrency(totalPremium)}</div>
          <div className="stat-card-label">Combined Premium</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{alerts}</div>
          <div className="stat-card-label">Renewal Alerts</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Linked Policies</span>
        </div>
        <div className="card-body">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Policy Type</th>
                  <th>Policy Number</th>
                  <th>Premium</th>
                  <th>Expiry</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((policy) => (
                  <tr key={policy._id}>
                    <td>
                      <div className="td-name">{policy.familyMemberName || policy.customerName}</div>
                      <div className="td-muted">{policy.familyRelationship || "Member"}</div>
                    </td>
                    <td><PolicyBadge type={policy.type} /></td>
                    <td style={{ fontFamily: "monospace", fontSize: 13 }}>{policy.policyNumber}</td>
                    <td>{formatCurrency(policy.premiumAmount)}</td>
                    <td>{formatDate(policy.endDate)}</td>
                    <td><StatusBadge status={getStatus(policy.endDate)} /></td>
                  </tr>
                ))}
                {policies.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                      No policies linked yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
