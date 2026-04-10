"use client";

import { useState } from "react";
import Link from "next/link";
import PolicyBadge from "@/components/PolicyBadge";
import WhatsAppModal from "@/components/WhatsAppModal";
import { PolicyType } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { AlertTriangle, ArrowRight } from "lucide-react";

export interface ExpiringPolicy {
  _id: string;
  customerName: string;
  phone: string;
  policyNumber: string;
  type: string;
  endDate: string;
  daysUntilExpiry: number;
}

export interface ExpiringPoliciesClientProps {
  expiring: ExpiringPolicy[];
}

export default function ExpiringPoliciesClient({
  expiring,
}: ExpiringPoliciesClientProps) {
  const [selectedPolicy, setSelectedPolicy] = useState<{
    customerName: string;
    phone: string;
    policyNumber: string;
    policyType: string;
    endDate: string;
  } | null>(null);

  return (
    <>
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <AlertTriangle size={15} style={{ color: "var(--fire)" }} />
            Policies Expiring Soon
          </span>
          {expiring.length > 0 && (
            <Link
              href="/dashboard/customers?filter=expiring"
              className="btn btn-sm btn-ghost"
            >
              View all <ArrowRight size={13} />
            </Link>
          )}
        </div>
        <div className="card-body" style={{ padding: "12px 20px" }}>
          {expiring.length === 0 ? (
            <div className="empty-state" style={{ padding: "30px 10px" }}>
              <div className="empty-state-icon">✅</div>
              <h3>All Clear!</h3>
              <p>No policies expiring in the next 30 days.</p>
            </div>
          ) : (
            expiring.map((p) => {
              const days = p.daysUntilExpiry;
              return (
                <div key={p._id} className="expiry-item">
                  <PolicyBadge type={p.type as PolicyType} />
                  <div className="expiry-item-info">
                    <div className="expiry-item-name">{p.customerName}</div>
                    <div className="expiry-item-meta">
                      {p.policyNumber} · Expires {formatDate(p.endDate)}
                    </div>
                  </div>
                  <span className="expiry-days">
                    {days === 0 ? "Today" : `${days}d`}
                  </span>
                  {/* Action Buttons */}
                  <div
                    style={{
                      display: "flex",
                      gap: "6px",
                      alignItems: "center",
                    }}
                  >
                    {/* WhatsApp Button */}
                    <button
                      onClick={() =>
                        setSelectedPolicy({
                          customerName: p.customerName,
                          phone: p.phone,
                          policyNumber: p.policyNumber,
                          policyType: p.type,
                          endDate: formatDate(p.endDate),
                        })
                      }
                      className="btn btn-sm"
                      style={{
                        background: "rgba(37, 211, 102, 0.1)",
                        color: "#25D366",
                        border: "1px solid rgba(37, 211, 102, 0.3)",
                        fontWeight: 600,
                      }}
                      title={`Send WhatsApp reminder to ${p.customerName}`}
                      onMouseEnter={(e) => {
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.background = "#25D366";
                        (e.currentTarget as HTMLButtonElement).style.color =
                          "#fff";
                      }}
                      onMouseLeave={(e) => {
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.background = "rgba(37, 211, 102, 0.1)";
                        (e.currentTarget as HTMLButtonElement).style.color =
                          "#25D366";
                      }}
                    >
                      💬
                    </button>

                    {/* View Button */}
                    <Link
                      href={`/dashboard/customers/${p._id}`}
                      className="btn btn-sm btn-ghost"
                    >
                      View
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* WhatsApp Modal */}
      <WhatsAppModal
        isOpen={!!selectedPolicy}
        onClose={() => setSelectedPolicy(null)}
        policy={selectedPolicy}
      />
    </>
  );
}
