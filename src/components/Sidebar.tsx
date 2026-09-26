'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Shield,
  Handshake,
  FileText,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  Sun,
  Moon,
} from 'lucide-react';

const navLinks = [
  { href: '/dashboard',              label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/customers',    label: 'Policies',  icon: Users           },
  { href: '/dashboard/customers/new',label: 'Add Policy',icon: UserPlus        },
  { href: '/dashboard/referrals',    label: 'Referrals', icon: Handshake       },
  { href: '/dashboard/claims',       label: 'Claims',    icon: FileText        },
];

export default function Sidebar() {
  const pathname   = usePathname();
  const [isOpen,     setIsOpen]     = useState(false);
  const [collapsed,  setCollapsed]  = useState(false);
  const [isDark,     setIsDark]     = useState(false);
  const [mounted,    setMounted]    = useState(false);

  // ── Boot: read persisted prefs ────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);

    // collapsed state
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === 'true') setCollapsed(true);

    // dark mode (already set by layout.tsx inline script, just sync state)
    const theme = document.documentElement.getAttribute('data-theme');
    setIsDark(theme === 'dark');

    // mobile sidebar toggle
    const handleToggle = () => setIsOpen(prev => !prev);
    window.addEventListener('toggle-sidebar', handleToggle);
    return () => window.removeEventListener('toggle-sidebar', handleToggle);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => { setIsOpen(false); }, [pathname]);

  // Sync collapsed class onto .main-wrapper so it shifts with the sidebar
  useEffect(() => {
    if (!mounted) return;
    const wrapper = document.querySelector('.main-wrapper') as HTMLElement | null;
    if (wrapper) wrapper.classList.toggle('sidebar-collapsed', collapsed);
    localStorage.setItem('sidebar-collapsed', String(collapsed));
  }, [collapsed, mounted]);

  function toggleCollapse() { setCollapsed(prev => !prev); }

  function toggleDark() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : '');
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }

  // On desktop, don't show collapsed sidebar (it uses the drawer pattern instead)
  const isCollapsed = collapsed && mounted;

  return (
    <>
      <div
        className={`sidebar-overlay${isOpen ? ' active' : ''}`.trim()}
        onClick={() => setIsOpen(false)}
      />
      <aside className={[
        'sidebar',
        isOpen ? 'mobile-open' : '',
        isCollapsed ? 'collapsed' : '',
      ].filter(Boolean).join(' ')}>

        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Shield size={22} />
          </div>
          {!isCollapsed && (
            <>
              <h1>InsureCRM</h1>
              <p>Agent Management System</p>
            </>
          )}
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {!isCollapsed && <span className="nav-section-label">Navigation</span>}
          {navLinks.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(href) &&
                  !(href === '/dashboard/customers' && pathname === '/dashboard/customers/new');
            return (
              <Link
                key={href}
                href={href}
                title={label}
                onClick={() => setIsOpen(false)}
                className={`nav-link${isActive ? ' active' : ''}`.trim()}
              >
                <Icon size={16} className="nav-icon" />
                {!isCollapsed && <span>{label}</span>}
              </Link>
            );
          })}

          {!isCollapsed && <span className="nav-section-label">Account</span>}
          <Link
            href="/dashboard/settings"
            title="Settings"
            onClick={() => setIsOpen(false)}
            className={`nav-link${pathname.startsWith('/dashboard/settings') ? ' active' : ''}`.trim()}
          >
            <Settings size={16} className="nav-icon" />
            {!isCollapsed && <span>Settings</span>}
          </Link>
        </nav>

        {/* Footer: dark mode toggle + collapse button */}
        <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Dark mode toggle */}
          <button
            onClick={toggleDark}
            className="sidebar-collapse-btn"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle dark mode"
          >
            {isDark
              ? <Sun  size={15} style={{ flexShrink: 0 }} />
              : <Moon size={15} style={{ flexShrink: 0 }} />
            }
            {!isCollapsed && (
              <span style={{ marginLeft: 8, fontSize: 12 }}>
                {isDark ? 'Light Mode' : 'Dark Mode'}
              </span>
            )}
          </button>

          {/* Collapse toggle — CSS hides it on mobile via .collapse-toggle-btn */}
          <button
            onClick={toggleCollapse}
            className="sidebar-collapse-btn collapse-toggle-btn"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label="Toggle sidebar collapse"
          >
            {isCollapsed
              ? <ChevronsRight size={15} style={{ flexShrink: 0 }} />
              : <ChevronsLeft  size={15} style={{ flexShrink: 0 }} />
            }
            {!isCollapsed && (
              <span style={{ marginLeft: 8, fontSize: 12 }}>Collapse</span>
            )}
          </button>

          {!isCollapsed && <p className="sidebar-footer-text">InsureCRM v1.0</p>}
        </div>
      </aside>
    </>
  );
}
