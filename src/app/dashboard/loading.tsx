export default function DashboardLoading() {
  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ 
            backgroundColor: 'var(--surface)', 
            border: '1px solid var(--border)', 
            borderRadius: 'var(--radius)', 
            padding: '20px',
            height: '120px',
            animation: 'shimmer 1.5s infinite linear',
            backgroundImage: 'linear-gradient(90deg, var(--surface) 0px, var(--border) 50%, var(--surface) 100%)',
            backgroundSize: '200% 100%'
          }} />
        ))}
      </div>
      <div style={{ 
        backgroundColor: 'var(--surface)', 
        border: '1px solid var(--border)', 
        borderRadius: 'var(--radius)', 
        padding: '20px',
        height: '400px',
        animation: 'shimmer 1.5s infinite linear',
        backgroundImage: 'linear-gradient(90deg, var(--surface) 0px, var(--border) 50%, var(--surface) 100%)',
        backgroundSize: '200% 100%'
      }} />
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}} />
    </div>
  );
}
