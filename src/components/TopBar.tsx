'use client';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Overview of all policies and alerts' },
  '/dashboard/customers': { title: 'Customers', subtitle: 'Manage all customer policies' },
  '/dashboard/customers/new': { title: 'Add Customer', subtitle: 'Create a new policy record' },
};

function getPageMeta(pathname: string) {
  if (pathname.match(/^\/dashboard\/customers\/[^/]+\/edit$/)) {
    return { title: 'Edit Customer', subtitle: 'Update policy details' };
  }
  if (pathname.match(/^\/dashboard\/customers\/[^/]+$/)) {
    return { title: 'Customer Detail', subtitle: 'Full policy information' };
  }
  return pageTitles[pathname] ?? { title: 'InsureCRM', subtitle: '' };
}

export default function TopBar() {
  const pathname  = usePathname();
  const router    = useRouter();
  const { data: session } = useSession();
  const { title, subtitle } = getPageMeta(pathname);

  const [dateStr, setDateStr] = useState<string>('');

  useEffect(() => {
    const now = new Date();
    setDateStr(now.toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
    }));
  }, []);

  async function handleLogout() {
    await signOut({ redirect: false });
    router.push('/login');
  }

  // Initials avatar from name
  const initials = session?.user?.name
    ? session.user.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <header className="topbar">
      <div className="topbar-left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button 
          className="mobile-menu-btn"
          onClick={() => window.dispatchEvent(new Event('toggle-sidebar'))}
          aria-label="Toggle Navigation"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>

      <div className="topbar-right">
        <span className="topbar-date">📅 {dateStr}</span>

        {/* User badge */}
        {session?.user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--primary)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ lineHeight: 1.3 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                {session.user.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {(session.user as { agencyName?: string }).agencyName ?? 'Agent'}
              </div>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          title="Logout"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 6,
            border: '1.5px solid var(--border)',
            background: 'transparent', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            color: 'var(--text-muted)',
            transition: 'all .15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = '#fde8e6';
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#f7b8b8';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--status-expired)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
          }}
        >
          {/* Log out icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Logout
        </button>
      </div>
    </header>
  );
}
