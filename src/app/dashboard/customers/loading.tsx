export default function CustomersLoading() {
  return (
    <div style={{ padding: '20px' }}>
      <div style={{ 
        backgroundColor: 'var(--surface)', 
        border: '1px solid var(--border)', 
        borderRadius: 'var(--radius)', 
        padding: '20px',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ 
            height: '40px', 
            backgroundColor: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            animation: 'shimmer 1.5s infinite linear',
            backgroundImage: 'linear-gradient(90deg, var(--surface) 0px, var(--border) 50%, var(--surface) 100%)',
            backgroundSize: '200% 100%'
          }} />
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ 
              height: '60px', 
              backgroundColor: 'var(--surface)',
              borderRadius: 'var(--radius)',
              animation: 'shimmer 1.5s infinite linear',
              backgroundImage: 'linear-gradient(90deg, var(--surface) 0px, var(--border) 50%, var(--surface) 100%)',
              backgroundSize: '200% 100%'
            }} />
          ))}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}} />
    </div>
  );
}
