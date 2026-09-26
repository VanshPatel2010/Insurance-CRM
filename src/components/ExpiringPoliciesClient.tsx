"use client";

import { useState } from "react";
import Link from "next/link";
import PolicyBadge from "@/components/PolicyBadge";
import WhatsAppModal from "@/components/WhatsAppModal";
import { PolicyType } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { AlertTriangle, ArrowRight, Eye } from "lucide-react";

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

/** WhatsApp SVG icon (brand colour) */
function WhatsAppIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

/** Returns urgency colour based on days remaining */
function urgencyStyle(days: number): React.CSSProperties {
  if (days === 0) return { color: "#fff", background: "var(--status-expired)", borderRadius: 4, padding: "2px 7px" };
  if (days <= 7)  return { color: "#fff", background: "var(--status-expiring)", borderRadius: 4, padding: "2px 7px" };
  return { color: "var(--status-expiring)", fontWeight: 700 };
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
            <AlertTriangle size={15} style={{ color: "var(--status-expiring)" }} />
            Expiring Soon
          </span>
          {expiring.length > 0 && (
            <Link href="/dashboard/customers?filter=expiring" className="btn btn-sm btn-ghost">
              View all <ArrowRight size={13} />
            </Link>
          )}
        </div>

        <div className="card-body" style={{ padding: "12px 20px" }}>
          {expiring.length === 0 ? (
            <div className="empty-state" style={{ padding: "30px 10px" }}>
              {/* SVG checkmark illustration */}
              <div style={{ marginBottom: 14 }}>
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ opacity: 0.4 }}>
                  <circle cx="32" cy="32" r="28" stroke="var(--status-active)" strokeWidth="2.5" fill="var(--status-active-bg)"/>
                  <path d="M20 32l9 9 15-15" stroke="var(--status-active)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
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

                  {/* Urgency badge */}
                  <span className="expiry-days" style={urgencyStyle(days)}>
                    {days === 0 ? "Today!" : days === 1 ? "1 day" : `${days}d`}
                  </span>

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                    {/* WhatsApp reminder */}
                    <button
                      onClick={() =>
                        setSelectedPolicy({
                          customerName: p.customerName,
                          phone:        p.phone,
                          policyNumber: p.policyNumber,
                          policyType:   p.type,
                          endDate:      formatDate(p.endDate),
                        })
                      }
                      className="btn btn-sm"
                      style={{
                        background: "rgba(37,211,102,.12)",
                        color: "#25D366",
                        border: "1px solid rgba(37,211,102,.3)",
                        padding: "5px 8px",
                      }}
                      title={`Send WhatsApp reminder to ${p.customerName}`}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = "#25D366";
                        (e.currentTarget as HTMLButtonElement).style.color = "#fff";
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = "rgba(37,211,102,.12)";
                        (e.currentTarget as HTMLButtonElement).style.color = "#25D366";
                      }}
                    >
                      <WhatsAppIcon size={14} />
                    </button>

                    {/* View */}
                    <Link href={`/dashboard/customers/${p._id}`} className="btn btn-sm btn-ghost" title="View policy">
                      <Eye size={13} />
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
