export default function CustomersLoading() {
  return (
    <div>
      {/* Page header skeleton */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div className="skeleton" style={{ width: 160, height: 24, borderRadius: 6, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: 220, height: 14, borderRadius: 4 }} />
        </div>
        <div className="skeleton" style={{ width: 110, height: 36, borderRadius: 8 }} />
      </div>

      {/* Filter bar skeleton */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div className="skeleton" style={{ flex: 1, height: 40, borderRadius: 6 }} />
        <div className="skeleton" style={{ width: 140, height: 40, borderRadius: 6 }} />
        <div className="skeleton" style={{ width: 130, height: 40, borderRadius: 6 }} />
      </div>

      {/* Table skeleton */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {["Customer", "Type", "Policy #", "Premium", "Expiry", "Status", "Actions"].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 10 }).map((_, i) => (
              <tr key={i} className="skeleton-row">
                <td>
                  <div className="skeleton" style={{ width: "70%", marginBottom: 6 }} />
                  <div className="skeleton" style={{ width: "45%", height: 10 }} />
                </td>
                <td><div className="skeleton" style={{ width: 70 }} /></td>
                <td><div className="skeleton" style={{ width: 90 }} /></td>
                <td><div className="skeleton" style={{ width: 60 }} /></td>
                <td><div className="skeleton" style={{ width: 75 }} /></td>
                <td><div className="skeleton" style={{ width: 55 }} /></td>
                <td><div className="skeleton" style={{ width: 50 }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
