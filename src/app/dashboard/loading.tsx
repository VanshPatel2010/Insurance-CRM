export default function DashboardLoading() {
  return (
    <div>
      {/* KPI row skeleton */}
      <div className="stat-grid kpi-grid" style={{ marginBottom: 24 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="stat-card" style={{ borderLeft: "4px solid var(--border)" }}>
            <div className="stat-card-header">
              <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 10 }} />
              <div className="skeleton" style={{ width: 60, height: 22, borderRadius: 4 }} />
            </div>
            <div className="skeleton" style={{ width: 70, height: 32, borderRadius: 4, marginTop: 8 }} />
            <div className="skeleton" style={{ width: 100, height: 14, borderRadius: 4, marginTop: 8 }} />
          </div>
        ))}
      </div>

      {/* Type breakdown skeleton */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="skeleton" style={{ width: 160, height: 18, borderRadius: 4 }} />
          <div className="skeleton" style={{ width: 90, height: 32, borderRadius: 6 }} />
        </div>
        <div className="card-body" style={{ padding: "8px 0" }}>
          <div className="type-breakdown-grid">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 16px",
                  borderRight: "1px solid var(--border-light)",
                  borderBottom: "1px solid var(--border-light)",
                }}
              >
                <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 8 }} />
                <div>
                  <div className="skeleton" style={{ width: 28, height: 20, borderRadius: 4, marginBottom: 5 }} />
                  <div className="skeleton" style={{ width: 55, height: 12, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts skeleton — uses .charts-grid for responsive 2→1 col */}
      <div className="charts-grid">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card">
            <div className="card-header">
              <div className="skeleton" style={{ width: 160, height: 16, borderRadius: 4 }} />
            </div>
            <div className="card-body">
              <div className="skeleton" style={{ height: 200, borderRadius: 8 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Bottom row skeleton — uses .dashboard-row */}
      <div className="dashboard-row" style={{ marginTop: 20 }}>
        {[...Array(2)].map((_, i) => (
          <div key={i} className="card">
            <div className="card-header">
              <div className="skeleton" style={{ width: 140, height: 16, borderRadius: 4 }} />
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[...Array(5)].map((_, j) => (
                <div key={j} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="skeleton" style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ width: "60%", height: 13, borderRadius: 4, marginBottom: 6 }} />
                    <div className="skeleton" style={{ width: "40%", height: 11, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
