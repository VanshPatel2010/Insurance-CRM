'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, UserPlus, FileText, Handshake } from 'lucide-react';

const tabs = [
  { href: '/dashboard',              label: 'Home',    icon: LayoutDashboard },
  { href: '/dashboard/customers',    label: 'Policies',icon: Users           },
  { href: '/dashboard/customers/new',label: 'Add',     icon: UserPlus        },
  { href: '/dashboard/referrals',    label: 'Referrals',icon: Handshake      },
  { href: '/dashboard/claims',       label: 'Claims',  icon: FileText        },
];

export default function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav className="mobile-tab-bar" aria-label="Mobile navigation">
      {tabs.map(({ href, label, icon: Icon }) => {
        const isActive =
          href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(href) &&
              !(href === '/dashboard/customers' && pathname === '/dashboard/customers/new');

        return (
          <Link
            key={href}
            href={href}
            className={`mobile-tab${isActive ? ' active' : ''}`}
            aria-label={label}
          >
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
