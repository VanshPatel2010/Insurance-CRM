"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate, daysUntilExpiry } from "@/lib/utils";
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
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { PolicyType } from "@/lib/types";

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

async function fetchDashboardStats() {
  const res = await fetch("/api/dashboard/stats");
  if (!res.ok) throw new Error("Failed to fetch dashboard data");
  const data = await res.json();
  const serializedExpiring = (data.expiring || []).map((p: any) => ({
    _id: p._id.toString(),
    customerName: p.customerName,
    phone: p.phone,
    policyNumber: p.policyNumber,
    type: p.type,
    endDate: p.endDate,
    daysUntilExpiry: daysUntilExpiry(p.endDate),
  }));
  return { ...data, expiring: serializedExpiring };
}

export default function DashboardClient({ initialData }: { initialData: any }) {
  const queryClient = useQueryClient();
  const { data, dataUpdatedAt, isFetching, refetch } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchDashboardStats,
    initialData,
    staleTime: Infinity,
  });

  const { total, typeCountMap, expiring, totalPremium, recent } = data;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          <span suppressHydrationWarning>
            {dataUpdatedAt
              ? `Last synced ${formatDistanceToNow(dataUpdatedAt)} ago`
              : "Synced"}
          </span>
          <button
            onClick={() => refetch()}
            className="btn btn-ghost btn-sm"
            disabled={isFetching}
            title="Force Refresh Cache"
          >
            <RefreshCw size={14} className={isFetching ? "spin" : ""} />
          </button>
        </div>
      </div>

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
                {typeCountMap?.[type] ?? 0}
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
            {expiring?.length ?? 0}
          </div>
          <div className="stat-card-label">Expiring in 30 Days</div>
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div className="dashboard-row">
        {/* Expiring Soon List - Client Component with Modal */}
        <ExpiringPoliciesClient expiring={expiring} />

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
            {recent?.length === 0 ? (
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
              recent?.map((p: any) => {
                const initials = ((p.customerName as string) || "?")
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <div key={p._id} className="recent-item">
                    <div className="recent-item-avatar">{initials}</div>
                    <div className="recent-item-info">
                      <Link
                        href={`/dashboard/customers/${p._id.toString()}`}
                        className="recent-item-title"
                      >
                        {p.customerName}
                      </Link>
                      <div className="recent-item-meta">
                        <PolicyBadge type={p.type} />
                        <span style={{ marginLeft: 8 }}>
                          {formatDate(p.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `,
        }}
      />
    </div>
  );
}
