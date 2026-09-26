"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Area,
  AreaChart,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import { formatCurrency } from "@/lib/utils";

/* ── Colour palette matching CSS variables ─────────────────────────────────── */
const TYPE_COLORS: Record<string, string> = {
  motor:                 "#185FA5",
  medical:               "#3B6D11",
  fire:                  "#BA7517",
  life:                  "#534AB7",
  "personal-accident":   "#a33b2d",
  marine:                "#0a6c74",
  "workman-compensation":"#6b4f1d",
  travel:                "#0891b2",
};

/* ── Shared tooltip style ────────────────────────────────────────────────────── */
const tooltipStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  boxShadow: "0 4px 12px rgba(0,0,0,.10)",
  fontSize: 12,
  color: "var(--text)",
};

/* ── Monthly bar chart ───────────────────────────────────────────────────────── */
function MonthlyPoliciesChart({ data }: { data: { month: string; count: number }[] }) {
  if (!data || data.length === 0) return <div className="empty-state">No data available</div>;

  const formatted = data.map(d => ({
    month: d.month.split("-")[1],   // "2024-03" → "03"
    count: d.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={formatted} barSize={20} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "var(--primary-light)" }}
          formatter={(value: unknown) => [Number(value), "Policies"]}
        />
        <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} animationDuration={600} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Monthly premium area chart ─────────────────────────────────────────────── */
function MonthlyPremiumChart({ data }: { data: { month: string; total: number }[] }) {
  if (!data || data.length === 0) return <div className="empty-state">No data available</div>;

  const formatted = data.map(d => ({
    month: d.month.split("-")[1],
    total: d.total,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={formatted} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="premiumGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#059669" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#059669" stopOpacity={0}    />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--text-muted)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: unknown) => [formatCurrency(Number(value)), "Premium"]}
        />
        <Area
          type="monotone"
          dataKey="total"
          stroke="#059669"
          strokeWidth={2}
          fill="url(#premiumGrad)"
          dot={{ r: 4, fill: "#059669", strokeWidth: 0 }}
          activeDot={{ r: 6, fill: "#059669" }}
          animationDuration={700}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── Policy type donut (PieChart) ────────────────────────────────────────────── */
function PolicyTypeDonut({ data }: { data: { type: string; count: number; premium: number }[] }) {
  if (!data || data.length === 0) return <div className="empty-state">No data available</div>;

  const total = data.reduce((s, d) => s + d.count, 0);

  const formatted = data.map(d => ({
    name:  d.type.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    value: d.count,
    color: TYPE_COLORS[d.type] ?? "var(--primary)",
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={formatted}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
          animationDuration={700}
          label={({ percent }) =>
            percent != null && percent > 0.08 ? `${(percent * 100).toFixed(0)}%` : ""
          }
          labelLine={false}
        >
          {formatted.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: unknown, name?: unknown) => [
            `${Number(value)} (${((Number(value) / total) * 100).toFixed(1)}%)`,
            String(name ?? ""),
          ]}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, color: "var(--text-muted)", paddingTop: 8 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ── Status summary segmented bar ────────────────────────────────────────────── */
function StatusSummaryBar({
  status,
}: {
  status: { active: number; expiring: number; expired: number };
}) {
  const total = status.active + status.expiring + status.expired;
  if (total === 0) return <div className="empty-state">No data available</div>;

  const activePct   = (status.active   / total) * 100;
  const expiringPct = (status.expiring / total) * 100;
  const expiredPct  = (status.expired  / total) * 100;

  const segments = [
    { label: "Active",        pct: activePct,   count: status.active,   color: "var(--status-active)"   },
    { label: "Expiring Soon", pct: expiringPct, count: status.expiring, color: "var(--status-expiring)" },
    { label: "Expired",       pct: expiredPct,  count: status.expired,  color: "var(--status-expired)"  },
  ];

  return (
    <div style={{ marginTop: 12 }}>
      {/* Segmented bar */}
      <div style={{
        display: "flex",
        width: "100%",
        height: 28,
        borderRadius: "var(--radius-sm)",
        overflow: "hidden",
        marginBottom: 16,
        gap: 2,
      }}>
        {segments.map(s => (
          s.pct > 0 && (
            <div
              key={s.label}
              style={{
                width: `${s.pct}%`,
                background: s.color,
                transition: "width 0.8s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title={`${s.label}: ${s.count}`}
            />
          )
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 20px" }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: s.color, flexShrink: 0,
            }} />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {s.label}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
              {s.count}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-light)" }}>
              ({s.pct.toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Exported composite ──────────────────────────────────────────────────────── */
export default function DashboardCharts({
  analyticsData,
}: {
  analyticsData: any;
}) {
  if (!analyticsData) return null;

  return (
    <div className="charts-grid">
      <div className="card">
        <div className="card-header">
          <span className="card-title">Policies Added (Last 12 Months)</span>
        </div>
        <div className="card-body">
          <MonthlyPoliciesChart data={analyticsData.monthlyPolicies} />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Premium Trend (Last 12 Months)</span>
        </div>
        <div className="card-body">
          <MonthlyPremiumChart data={analyticsData.monthlyPremiums} />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Policy Distribution</span>
        </div>
        <div className="card-body">
          <PolicyTypeDonut data={analyticsData.typeDistribution} />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Status Summary</span>
        </div>
        <div className="card-body">
          <StatusSummaryBar status={analyticsData.statusSummary} />
        </div>
      </div>
    </div>
  );
}
