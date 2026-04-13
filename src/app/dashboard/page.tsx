/**
 * Dashboard page — Server Component.
 *
 * DATA FETCHING STRATEGY (LCP impact):
 * ─────────────────────────────────────
 * OLD: 'use client' + useEffect → fetch('/api/dashboard/stats')
 *      → Browser downloads JS → runs React → fires fetch → waits for network
 *      → renders content. The LCP element (stat numbers) only appears after
 *        ~3 round-trips: HTML → JS bundle → API response.
 *
 * NEW: async Server Component that calls the DB directly on the server.
 *      The HTML sent to the browser already contains the stats. LCP = first paint.
 *      The client downloads ZERO JavaScript for this page's data logic.
 *
 * CRITICAL REQUEST CHAIN: eliminated.
 * HTML → rendered (no waterfall for data).
 */

import Link from "next/link";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import Customer from "@/models/Customer";
import { formatCurrency, formatDate, daysUntilExpiry } from "@/lib/utils";
import { PolicyType } from "@/lib/types";
import PolicyBadge from "@/components/PolicyBadge";
import StatusBadge from "@/components/StatusBadge";
import ExpiringPoliciesClient from "@/components/ExpiringPoliciesClient";
import {
  Users,
  Car,
  Heart,
  Flame,
  Shield,
  User,
  Ship,
  Briefcase,
  AlertTriangle,
  Plane,
  Clock,
  TrendingUp,
  ArrowRight,
  Plus,
} from "lucide-react";

// ── Metadata (static, no JS cost) ─────────────────────────────────────────────
export const metadata = {
  title: "Dashboard — InsureCRM",
};

// ── Revalidate every 60 s on Vercel (ISR) — fresh data without a full SSR hit ─
export const revalidate = 60;

// ── Policy type display config (server-only, never sent to the client) ─────────
const typeConfig: Record<
  PolicyType,
  { label: string; icon: any; color: string; bg: string }
> = {
  motor: { label: "Motor", icon: Car, color: "#185FA5", bg: "#e9f2fc" },
  medical: { label: "Medical", icon: Heart, color: "#3B6D11", bg: "#edf7e4" },
  fire: { label: "Fire", icon: Flame, color: "#BA7517", bg: "#fef4e0" },
  life: { label: "Life", icon: Shield, color: "#534AB7", bg: "#eeecfb" },
  "personal-accident": {
    label: "Personal Accident",
    icon: User,
    color: "#a33b2d",
    bg: "#fcebe8",
  },
  marine: { label: "Marine", icon: Ship, color: "#0a6c74", bg: "#e6f7f8" },
  "workman-compensation": {
    label: "Workman Compensation",
    icon: Briefcase,
    color: "#6b4f1d",
    bg: "#f8f0df",
  },
  travel: { label: "Travel", icon: Plane, color: "#0891b2", bg: "#ecf7fa" },
};

// ── Server-side data fetch ────────────────────────────────────────────────────
async function getDashboardData(agentIdStr: string) {
  await connectDB();

  // Session stores agentId as a string; convert to ObjectId for Mongoose queries
  const agentId = new mongoose.Types.ObjectId(agentIdStr);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [total, typeCounts, expiring, premiumAgg, recent] = await Promise.all([
    // Total count
    Customer.countDocuments({ agentId }),

    // Per-type counts
    Customer.aggregate([
      { $match: { agentId } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]),

    // Expiring in 30 days
    Customer.find({
      agentId,
      endDate: {
        $gte: today.toISOString().slice(0, 10),
        $lte: in30.toISOString().slice(0, 10),
      },
    })
      .sort({ endDate: 1 })
      .limit(10)
      .lean(),

    // Sum of premiums
    Customer.aggregate([
      { $match: { agentId } },
      {
        $group: { _id: null, total: { $sum: { $toDouble: "$premiumAmount" } } },
      },
    ]),

    // Recently added
    Customer.find({ agentId }).sort({ createdAt: -1 }).limit(8).lean(),
  ]);

  const typeCountMap = Object.fromEntries(
    (typeCounts as { _id: string; count: number }[]).map(({ _id, count }) => [
      _id,
      count,
    ]),
  );

  return {
    total,
    typeCountMap,
    expiring: expiring as unknown as Array<Record<string, string>>,
    totalPremium: premiumAgg[0]?.total ?? 0,
    recent: recent as unknown as Array<Record<string, string>>,
  };
}

// ── Page component ─────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const agentId = session.user.id as string;
  const { total, typeCountMap, expiring, totalPremium, recent } =
    await getDashboardData(agentId);

  // Serialize expiring policies for client component
  // Convert ObjectIds to strings and pre-calculate days
  const serializedExpiring = expiring.map((p: any) => ({
    _id: p._id.toString(),
    customerName: p.customerName,
    phone: p.phone,
    policyNumber: p.policyNumber,
    type: p.type,
    endDate: p.endDate,
    daysUntilExpiry: daysUntilExpiry(p.endDate),
  }));

  return (
    <div>
      {/* ── Stat Grid ── */}
      <div className="stat-grid">
        {/* Total Customers */}
        <div
          className="stat-card"
          style={{ borderLeft: "4px solid var(--primary)" }}
        >
          <div className="stat-card-header">
            <div
              className="stat-card-icon"
              style={{
                background: "var(--primary-light)",
                color: "var(--primary)",
              }}
            >
              <Users size={20} />
            </div>
            <span
              className="stat-card-badge"
              style={{
                background: "var(--primary-light)",
                color: "var(--primary)",
              }}
            >
              All Types
            </span>
          </div>
          <div className="stat-card-value" style={{ color: "var(--primary)" }}>
            {total}
          </div>
          <div className="stat-card-label">Total Customers</div>
        </div>

        {/* Per-type cards */}
        {(Object.keys(typeConfig) as PolicyType[]).map((type) => {
          const cfg = typeConfig[type];
          const Icon = cfg.icon;
          return (
            <div
              key={type}
              className="stat-card"
              style={{ borderLeft: `4px solid ${cfg.color}` }}
            >
              <div className="stat-card-header">
                <div
                  className="stat-card-icon"
                  style={{ background: cfg.bg, color: cfg.color }}
                >
                  <Icon size={20} />
                </div>
                <span
                  className="stat-card-badge"
                  style={{ background: cfg.bg, color: cfg.color }}
                >
                  {cfg.label}
                </span>
              </div>
              <div className="stat-card-value" style={{ color: cfg.color }}>
                {typeCountMap[type] ?? 0}
              </div>
              <div className="stat-card-label">{cfg.label} Policies</div>
            </div>
          );
        })}

        {/* Total Premium */}
        <div className="stat-card" style={{ borderLeft: "4px solid #059669" }}>
          <div className="stat-card-header">
            <div
              className="stat-card-icon"
              style={{ background: "#d1fae5", color: "#059669" }}
            >
              <TrendingUp size={20} />
            </div>
            <span
              className="stat-card-badge"
              style={{ background: "#d1fae5", color: "#059669" }}
            >
              Revenue
            </span>
          </div>
          <div
            className="stat-card-value"
            style={{ color: "#059669", fontSize: 20, letterSpacing: "-0.5px" }}
          >
            {formatCurrency(totalPremium)}
          </div>
          <div className="stat-card-label">Total Premium</div>
        </div>

        {/* Expiring Soon */}
        <div
          className="stat-card"
          style={{ borderLeft: "4px solid var(--fire)" }}
        >
          <div className="stat-card-header">
            <div
              className="stat-card-icon"
              style={{ background: "var(--fire-bg)", color: "var(--fire)" }}
            >
              <AlertTriangle size={20} />
            </div>
            <span
              className="stat-card-badge"
              style={{ background: "var(--fire-bg)", color: "var(--fire)" }}
            >
              Alert
            </span>
          </div>
          <div className="stat-card-value" style={{ color: "var(--fire)" }}>
            {expiring.length}
          </div>
          <div className="stat-card-label">Expiring in 30 Days</div>
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div className="dashboard-row">
        {/* Expiring Soon List - Client Component with Modal */}
        <ExpiringPoliciesClient expiring={serializedExpiring} />

        {/* Recently Added */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Clock size={15} style={{ color: "var(--primary)" }} />
              Recently Added
            </span>
            <Link href="/dashboard/customers" className="btn btn-sm btn-ghost">
              View all <ArrowRight size={13} />
            </Link>
          </div>
          <div className="card-body" style={{ padding: "12px 20px" }}>
            {recent.length === 0 ? (
              <div className="empty-state" style={{ padding: "30px 10px" }}>
                <div className="empty-state-icon">📋</div>
                <h3>No customers yet</h3>
                <p>Add your first customer to get started.</p>
                <Link
                  href="/dashboard/customers/new"
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: 12 }}
                >
                  <Plus size={14} /> Add Customer
                </Link>
              </div>
            ) : (
              recent.map((p) => {
                const initials = (p.customerName as string)
                  .split(" ")
                  .map((n: string) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const in30 = new Date(
                  today.getTime() + 30 * 24 * 60 * 60 * 1000,
                );
                const endD = new Date(p.endDate);
                const status =
                  endD < today
                    ? "Expired"
                    : endD <= in30
                      ? "Expiring Soon"
                      : "Active";
                return (
                  <div key={p._id} className="recent-item">
                    <div className="recent-avatar">{initials}</div>
                    <div className="recent-info">
                      <div className="recent-name">{p.customerName}</div>
                      <div className="recent-meta">
                        <PolicyBadge type={p.type as PolicyType} />
                        &nbsp;
                        {p.policyNumber}
                      </div>
                    </div>
                    <StatusBadge status={status} />
                    <Link
                      href={`/dashboard/customers/${p._id}`}
                      className="btn btn-sm btn-ghost"
                      style={{ marginLeft: 4 }}
                    >
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Quick Add CTA ── */}
      {total === 0 && (
        <div
          className="card"
          style={{
            background:
              "linear-gradient(135deg, var(--primary) 0%, var(--primary-mid) 100%)",
            border: "none",
            padding: 32,
            textAlign: "center",
            color: "#fff",
          }}
        >
          <Shield size={40} style={{ opacity: 0.7, marginBottom: 12 }} />
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>
            Welcome to InsureCRM
          </h2>
          <p style={{ opacity: 0.8, marginBottom: 20, fontSize: 14 }}>
            Start by adding your first customer policy record.
          </p>
          <Link
            href="/dashboard/customers/new"
            className="btn btn-lg"
            style={{
              background: "#fff",
              color: "var(--primary)",
              fontWeight: 700,
            }}
          >
            <Plus size={18} /> Add First Customer
          </Link>
        </div>
      )}
    </div>
  );
}
