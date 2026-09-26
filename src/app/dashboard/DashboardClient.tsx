"use client";

import Link from "next/link";
import { useState, useCallback, useEffect } from "react";
import { formatCurrency, formatDate, daysUntilExpiry } from "@/lib/utils";
import PolicyBadge from "@/components/PolicyBadge";
import StatusBadge from "@/components/StatusBadge";
import ExpiringPoliciesClient from "@/components/ExpiringPoliciesClient";
import DashboardCharts from "@/components/DashboardCharts";
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
  motor:                 { label: "Motor",               icon: Car,       color: "#185FA5", bg: "#e9f2fc" },
  medical:               { label: "Medical",             icon: Heart,     color: "#3B6D11", bg: "#edf7e4" },
  fire:                  { label: "Fire",                icon: Flame,     color: "#BA7517", bg: "#fef4e0" },
  life:                  { label: "Life",                icon: Shield,    color: "#534AB7", bg: "#eeecfb" },
  "personal-accident":   { label: "Personal Accident",   icon: User,      color: "#a33b2d", bg: "#fcebe8" },
  marine:                { label: "Marine",              icon: Ship,      color: "#0a6c74", bg: "#e6f7f8" },
  "workman-compensation":{ label: "Workman Comp.",       icon: Briefcase, color: "#6b4f1d", bg: "#f8f0df" },
  travel:                { label: "Travel",              icon: Plane,     color: "#0891b2", bg: "#ecf7fa" },
};

async function fetchDashboardStats(range?: { from?: string; to?: string }) {
  const params = new URLSearchParams();
  if (range?.from) params.set("from", range.from);
  if (range?.to)   params.set("to", range.to);
  const query = params.toString();
  const res = await fetch(`/api/dashboard/stats${query ? `?${query}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch dashboard data");
  const data = await res.json();
  const serializedExpiring = (data.expiring || []).map((p: any) => ({
    _id:            p._id.toString(),
    customerName:   p.customerName,
    phone:          p.phone,
    policyNumber:   p.policyNumber,
    type:           p.type,
    endDate:        p.endDate,
    daysUntilExpiry: daysUntilExpiry(p.endDate),
  }));
  return { ...data, expiring: serializedExpiring };
}

export default function DashboardClient({ initialData }: { initialData: any }) {
  const currentYear = new Date().getFullYear();
  const [data,           setData]           = useState(initialData);
  const [premiumRangeMode, setPremiumRangeMode] = useState("current-year");
  const [premiumRange,   setPremiumRange]   = useState({
    from: `${currentYear}-01-01`,
    to:   `${currentYear}-12-31`,
  });
  const [isFetching,     setIsFetching]     = useState(false);
  const [dataUpdatedAt,  setDataUpdatedAt]  = useState<number | null>(null);
  const [analyticsData,  setAnalyticsData]  = useState<any>(null);

  useEffect(() => {
    fetch("/api/dashboard/analytics")
      .then(res => res.json())
      .then(data => setAnalyticsData(data))
      .catch(err => console.error("Failed to fetch analytics", err));
  }, []);

  const refetch = useCallback(async (range = premiumRange) => {
    setIsFetching(true);
    try {
      const fresh = await fetchDashboardStats(
        premiumRangeMode === "all-time" ? undefined : range,
      );
      setData(fresh);
      setDataUpdatedAt(Date.now());
    } catch (err) {
      console.error("[DashboardClient] Refresh failed:", err);
    } finally {
      setIsFetching(false);
    }
  }, [premiumRange, premiumRangeMode]);

  const changePremiumRange = useCallback(async (mode: string) => {
    setPremiumRangeMode(mode);
    let range = premiumRange;
    if (mode === "current-year")  range = { from: `${currentYear}-01-01`,     to: `${currentYear}-12-31`     };
    if (mode === "previous-year") range = { from: `${currentYear - 1}-01-01`, to: `${currentYear - 1}-12-31` };
    if (mode !== "all-time" && mode !== "custom") setPremiumRange(range);
    setIsFetching(true);
    try {
      const fresh = await fetchDashboardStats(mode === "all-time" ? undefined : range);
      setData(fresh);
      setDataUpdatedAt(Date.now());
    } finally {
      setIsFetching(false);
    }
  }, [currentYear, premiumRange]);

  const { total, typeCountMap, expiring, totalPremium, recent } = data;

  // Derive active count from analytics if available
  const activeCount   = analyticsData?.statusSummary?.active   ?? "—";
  const expiringTotal = analyticsData?.statusSummary?.expiring  ?? expiring?.length ?? 0;

  return (
    <div>
      {/* ── Topbar sync row ── */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
          <span suppressHydrationWarning>
            {dataUpdatedAt ? `Last synced ${formatDistanceToNow(dataUpdatedAt)} ago` : "Synced"}
          </span>
          <button
            onClick={() => refetch()}
            className="btn btn-ghost btn-sm"
            disabled={isFetching}
            title="Force Refresh"
          >
            <RefreshCw size={14} className={isFetching ? "spin" : ""} />
          </button>
        </div>
      </div>

      {/* ── Primary KPI Row (4 cards only) ── */}
      <div className="stat-grid kpi-grid" style={{ marginBottom: 24 }}>

        {/* 1. Total Policies */}
        <div className="stat-card" style={{ borderLeft: "4px solid var(--primary)" }}>
          <div className="stat-card-header">
            <div className="stat-card-icon" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
              <Users size={20} />
            </div>
            <span className="stat-card-badge" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
              All Types
            </span>
          </div>
          <div className="stat-card-value" style={{ color: "var(--primary)" }}>{total}</div>
          <div className="stat-card-label">Total Policies</div>
        </div>

        {/* 2. Active Policies */}
        <div className="stat-card" style={{ borderLeft: "4px solid var(--status-active)" }}>
          <div className="stat-card-header">
            <div className="stat-card-icon" style={{ background: "var(--status-active-bg)", color: "var(--status-active)" }}>
              <Shield size={20} />
            </div>
            <span className="stat-card-badge" style={{ background: "var(--status-active-bg)", color: "var(--status-active)" }}>
              Live
            </span>
          </div>
          <div className="stat-card-value" style={{ color: "var(--status-active)" }}>{activeCount}</div>
          <div className="stat-card-label">Active Policies</div>
        </div>

        {/* 3. Total Premium (with range selector) */}
        <div className="stat-card" style={{ borderLeft: "4px solid #059669" }}>
          <div className="stat-card-header">
            <div className="stat-card-icon" style={{ background: "#d1fae5", color: "#059669" }}>
              <TrendingUp size={20} />
            </div>
            <span className="stat-card-badge" style={{ background: "#d1fae5", color: "#059669" }}>Revenue</span>
          </div>
          <div className="stat-card-value" style={{ color: "#059669", fontSize: 20, letterSpacing: "-0.5px" }}>
            {formatCurrency(totalPremium)}
          </div>
          <div className="stat-card-label">Total Premium</div>
          <select
            className="form-select"
            aria-label="Premium duration"
            value={premiumRangeMode}
            onChange={(e) => changePremiumRange(e.target.value)}
            style={{ marginTop: 10, fontSize: 12, padding: "5px 8px", width: "100%" }}
          >
            <option value="current-year">Current Year</option>
            <option value="previous-year">Previous Year</option>
            <option value="all-time">All Time</option>
            <option value="custom">Custom Range</option>
          </select>
          {premiumRangeMode === "custom" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
              <input
                type="date" className="form-input" aria-label="From date"
                value={premiumRange.from}
                onChange={(e) => setPremiumRange(r => ({ ...r, from: e.target.value }))}
                onBlur={() => refetch()}
              />
              <input
                type="date" className="form-input" aria-label="To date"
                value={premiumRange.to}
                onChange={(e) => setPremiumRange(r => ({ ...r, to: e.target.value }))}
                onBlur={() => refetch()}
              />
            </div>
          )}
        </div>

        {/* 4. Expiring Soon */}
        <div className="stat-card" style={{ borderLeft: "4px solid var(--status-expiring)" }}>
          <div className="stat-card-header">
            <div className="stat-card-icon" style={{ background: "var(--status-expiring-bg)", color: "var(--status-expiring)" }}>
              <AlertTriangle size={20} />
            </div>
            <span className="stat-card-badge" style={{ background: "var(--status-expiring-bg)", color: "var(--status-expiring)" }}>
              Alert
            </span>
          </div>
          <div className="stat-card-value" style={{ color: "var(--status-expiring)" }}>
            {expiring?.length ?? 0}
          </div>
          <div className="stat-card-label">Expiring in 30 Days</div>
          {(expiring?.length ?? 0) > 0 && (
            <Link
              href="/dashboard/customers?filter=expiring"
              className="btn btn-sm btn-ghost"
              style={{ marginTop: 10, fontSize: 11, padding: "4px 8px" }}
            >
              View all <ArrowRight size={11} />
            </Link>
          )}
        </div>
      </div>

      {/* ── Policy Type Breakdown (compact table, replaces per-type cards) ── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">Policy Type Breakdown</span>
          <Link href="/dashboard/customers/new" className="btn btn-sm btn-primary">
            <Plus size={13} /> Add Policy
          </Link>
        </div>
        <div className="card-body" style={{ padding: "8px 0" }}>
          <div className="type-breakdown-grid">
            {(Object.keys(typeConfig) as PolicyType[]).map((type) => {
              const cfg  = typeConfig[type];
              const Icon = cfg.icon;
              const count = typeCountMap?.[type] ?? 0;
              return (
                <Link
                  key={type}
                  href={`/dashboard/customers?type=${type}`}
                  className="type-breakdown-cell"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 16px",
                    borderRight: "1px solid var(--border-light)",
                    borderBottom: "1px solid var(--border-light)",
                    textDecoration: "none",
                    transition: "background .15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = cfg.bg)}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: cfg.bg, color: cfg.color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <Icon size={15} />
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: cfg.color, lineHeight: 1 }}>{count}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{cfg.label}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Analytics Charts ── */}
      <DashboardCharts analyticsData={analyticsData} />

      {/* ── Bottom Row: Expiring + Recently Added ── */}
      <div className="dashboard-row">
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
                <div style={{ marginBottom: 14 }}>
                  {/* Inline SVG illustration */}
                  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ opacity: 0.35 }}>
                    <rect x="8" y="12" width="48" height="40" rx="4" stroke="var(--text-muted)" strokeWidth="2.5" fill="none"/>
                    <line x1="18" y1="24" x2="46" y2="24" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="18" y1="32" x2="38" y2="32" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="18" y1="40" x2="30" y2="40" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="48" cy="48" r="10" fill="var(--primary)" opacity="0.9"/>
                    <line x1="48" y1="44" x2="48" y2="52" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                    <line x1="44" y1="48" x2="52" y2="48" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <h3>No customers yet</h3>
                <p>Add your first customer to get started.</p>
                <Link href="/dashboard/customers/new" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
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
                  <Link
                    key={p._id}
                    href={`/dashboard/customers/${p._id.toString()}`}
                    className="recent-item"
                    style={{ textDecoration: "none" }}
                  >
                    <div className="recent-avatar">{initials}</div>
                    <div className="recent-info" style={{ flex: 1, minWidth: 0 }}>
                      <div className="recent-name">{p.customerName}</div>
                      <div className="recent-meta" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                        <PolicyBadge type={p.type} />
                        <span>{formatDate(p.createdAt)}</span>
                      </div>
                    </div>
                    <ArrowRight size={14} style={{ color: "var(--text-light)", flexShrink: 0 }} />
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
