"use client";

import { useMemo } from "react";
import { formatCurrency } from "@/lib/utils";

// SVGs and components for zero-bundle charts
function MonthlyPoliciesChart({ data }: { data: { month: string; count: number }[] }) {
  if (!data || data.length === 0) return <div className="empty-state">No data available</div>;
  
  const max = Math.max(...data.map(d => d.count), 1);
  const height = 180;
  
  return (
    <div style={{ position: "relative", height: height + 30, width: "100%", marginTop: 10 }}>
      <svg width="100%" height="100%" preserveAspectRatio="none">
        {data.map((d, i) => {
          const barWidth = 100 / data.length;
          const barHeight = (d.count / max) * height;
          const x = i * barWidth;
          const y = height - barHeight;
          return (
            <g key={i}>
              <rect
                x={`${x + barWidth * 0.2}%`}
                y={y}
                width={`${barWidth * 0.6}%`}
                height={barHeight}
                fill="var(--primary)"
                rx="4"
                style={{ transition: "all 0.3s ease", cursor: "pointer" }}
                className="chart-bar"
              />
              {/* Tooltip hint placeholder - normally would use a state for hover */}
              <text x={`${x + barWidth * 0.5}%`} y={height + 20} fontSize="10" fill="var(--text-muted)" textAnchor="middle">
                {d.month.split("-")[1]}
              </text>
            </g>
          );
        })}
      </svg>
      <style dangerouslySetInnerHTML={{__html: `
        .chart-bar:hover { opacity: 0.8; }
      `}} />
    </div>
  );
}

function PolicyTypeDonut({ data }: { data: { type: string; count: number; premium: number }[] }) {
  if (!data || data.length === 0) return <div className="empty-state">No data available</div>;

  const total = data.reduce((sum, d) => sum + d.count, 0);
  let currentAngle = -90; // Start at top
  const radius = 60;
  const center = 100;

  const getCoordinatesForAngle = (angle: number) => {
    const angleInRadians = (angle * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(angleInRadians),
      y: center + radius * Math.sin(angleInRadians)
    };
  };

  const cssVars: Record<string, string> = {
    motor: "var(--motor)",
    medical: "var(--medical)",
    fire: "var(--fire)",
    life: "var(--life)",
    "personal-accident": "var(--personal-accident)",
    marine: "var(--marine)",
    "workman-compensation": "var(--workman-compensation)",
    travel: "var(--travel)",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <svg width="200" height="200" viewBox="0 0 200 200">
        {data.map((d, i) => {
          const sliceAngle = (d.count / total) * 360;
          const start = getCoordinatesForAngle(currentAngle);
          currentAngle += sliceAngle;
          const end = getCoordinatesForAngle(currentAngle);
          
          const largeArcFlag = sliceAngle > 180 ? 1 : 0;
          const pathData = [
            `M ${center} ${center}`,
            `L ${start.x} ${start.y}`,
            `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
            "Z"
          ].join(" ");

          // If slice is 100%, render a circle instead
          if (sliceAngle === 360) {
            return <circle key={i} cx={center} cy={center} r={radius} fill={cssVars[d.type] || "var(--primary)"} />;
          }

          return (
            <path
              key={i}
              d={pathData}
              fill={cssVars[d.type] || "var(--primary)"}
              style={{ transition: "all 0.3s ease", cursor: "pointer" }}
              className="chart-slice"
            />
          );
        })}
        {/* Inner circle for donut hole */}
        <circle cx={center} cy={center} r="40" fill="var(--surface)" />
        <text x={center} y={center + 5} textAnchor="middle" fontSize="16" fontWeight="bold" fill="var(--text)">
          {total}
        </text>
      </svg>
      
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: cssVars[d.type] || "var(--primary)" }} />
              <span style={{ textTransform: "capitalize", color: "var(--text-muted)" }}>{d.type.replace("-", " ")}</span>
            </div>
            <span style={{ fontWeight: 600 }}>{d.count}</span>
          </div>
        ))}
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .chart-slice:hover { opacity: 0.8; }
      `}} />
    </div>
  );
}

function MonthlyPremiumChart({ data }: { data: { month: string; total: number }[] }) {
  if (!data || data.length === 0) return <div className="empty-state">No data available</div>;

  const max = Math.max(...data.map(d => d.total), 1);
  const height = 180;
  
  const points = data.map((d, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * 100;
    const y = height - (d.total / max) * height;
    return `${x}%,${y}`;
  }).join(" ");

  const polygonPoints = `0%,${height} ${points} 100%,${height}`;

  return (
    <div style={{ position: "relative", height: height + 30, width: "100%", marginTop: 10 }}>
      <svg width="100%" height="100%" preserveAspectRatio="none" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="premiumGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#059669" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={polygonPoints} fill="url(#premiumGrad)" />
        <polyline points={points} fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        
        {data.map((d, i) => {
          const x = (i / Math.max(data.length - 1, 1)) * 100;
          const y = height - (d.total / max) * height;
          return (
            <g key={i}>
              <circle cx={`${x}%`} cy={y} r="4" fill="#059669" className="chart-point" />
              <text x={`${x}%`} y={height + 20} fontSize="10" fill="var(--text-muted)" textAnchor="middle">
                {d.month.split("-")[1]}
              </text>
            </g>
          );
        })}
      </svg>
      <style dangerouslySetInnerHTML={{__html: `
        .chart-point { transition: r 0.2s; cursor: pointer; }
        .chart-point:hover { r: 6; }
      `}} />
    </div>
  );
}

function StatusSummaryBar({ status }: { status: { active: number; expiring: number; expired: number } }) {
  const total = status.active + status.expiring + status.expired;
  if (total === 0) return <div className="empty-state">No data available</div>;

  const activePct = (status.active / total) * 100;
  const expiringPct = (status.expiring / total) * 100;
  const expiredPct = (status.expired / total) * 100;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", width: "100%", height: 24, borderRadius: "var(--radius-sm)", overflow: "hidden", marginBottom: 12 }}>
        <div style={{ width: `${activePct}%`, background: "var(--status-active)", transition: "width 1s" }} title={`Active: ${status.active}`} />
        <div style={{ width: `${expiringPct}%`, background: "var(--status-expiring)", transition: "width 1s" }} title={`Expiring: ${status.expiring}`} />
        <div style={{ width: `${expiredPct}%`, background: "var(--status-expired)", transition: "width 1s" }} title={`Expired: ${status.expired}`} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--status-active)" }} />
          <span style={{ color: "var(--text-muted)" }}>Active ({activePct.toFixed(1)}%)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--status-expiring)" }} />
          <span style={{ color: "var(--text-muted)" }}>Expiring ({expiringPct.toFixed(1)}%)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--status-expired)" }} />
          <span style={{ color: "var(--text-muted)" }}>Expired ({expiredPct.toFixed(1)}%)</span>
        </div>
      </div>
    </div>
  );
}

export default function DashboardCharts({ analyticsData }: { analyticsData: any }) {
  if (!analyticsData) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Policies (Last 12 Months)</span>
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
