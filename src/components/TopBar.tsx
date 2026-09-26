"use client";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Calendar, Bell } from "lucide-react";

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": {
    title: "Dashboard",
    subtitle: "Overview of all policies and alerts",
  },
  "/dashboard/customers": {
    title: "Policies",
    subtitle: "Manage all customer policies",
  },
  "/dashboard/customers/new": {
    title: "Add Policy",
    subtitle: "Create a new policy record",
  },
  "/dashboard/referrals": {
    title: "Referrals",
    subtitle: "Track and manage referrals",
  },
  "/dashboard/claims": {
    title: "Claims",
    subtitle: "Monitor and process claims",
  },
  "/dashboard/settings": {
    title: "Settings",
    subtitle: "Account and agency preferences",
  },
};

/** Returns `{ title, subtitle, crumbs? }` — crumbs used for nested pages */
function getPageMeta(pathname: string): {
  title: string;
  subtitle: string;
  crumbs?: { label: string; href: string }[];
} {
  if (pathname.match(/^\/dashboard\/customers\/[^/]+\/edit$/)) {
    return {
      title: "Edit Policy",
      subtitle: "Update policy details",
      crumbs: [
        { label: "Policies", href: "/dashboard/customers" },
        { label: "Edit", href: pathname },
      ],
    };
  }
  if (pathname.match(/^\/dashboard\/customers\/[^/]+$/)) {
    return {
      title: "Policy Detail",
      subtitle: "Full policy information",
      crumbs: [
        { label: "Policies", href: "/dashboard/customers" },
        { label: "Detail", href: pathname },
      ],
    };
  }
  if (pathname.match(/^\/dashboard\/referrals\/[^/]+$/)) {
    return {
      title: "Referral Detail",
      subtitle: "Commission breakdown",
      crumbs: [
        { label: "Referrals", href: "/dashboard/referrals" },
        { label: "Detail", href: pathname },
      ],
    };
  }
  if (pathname.match(/^\/dashboard\/claims\/[^/]+\/edit$/)) {
    return {
      title: "Edit Claim",
      subtitle: "Update claim details",
      crumbs: [
        { label: "Claims", href: "/dashboard/claims" },
        { label: "Edit", href: pathname },
      ],
    };
  }
  if (pathname.match(/^\/dashboard\/claims\/[^/]+$/)) {
    return {
      title: "Claim Detail",
      subtitle: "Full claim information",
      crumbs: [
        { label: "Claims", href: "/dashboard/claims" },
        { label: "Detail", href: pathname },
      ],
    };
  }
  return pageTitles[pathname] ?? { title: "InsureCRM", subtitle: "" };
}

export default function TopBar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { data: session } = useSession();
  const { title, subtitle, crumbs } = getPageMeta(pathname);

  const [dateStr,       setDateStr]       = useState<string>("");
  const [expiringCount, setExpiringCount] = useState<number>(0);

  useEffect(() => {
    const now = new Date();
    setDateStr(
      now.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    );
  }, []);

  // Fetch expiring-soon count for the notification bell (lightweight)
  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.expiring) setExpiringCount(data.expiring.length);
      })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await signOut({ redirect: false });
    router.push("/login");
  }

  // Initials avatar from name
  const initials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  return (
    <header className="topbar">
      <div className="topbar-left">
        {/* Hamburger — CSS shows only on mobile */}
        <button
          className="mobile-menu-btn"
          onClick={() => window.dispatchEvent(new Event("toggle-sidebar"))}
          aria-label="Toggle Navigation"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6"  x2="21" y2="6"  />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div style={{ minWidth: 0 }}>
          {/* Breadcrumb for nested pages */}
          {crumbs && crumbs.length > 0 ? (
            <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "nowrap", overflow: "hidden" }}>
              {crumbs.map((crumb, i) => (
                <span key={crumb.href} style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                  {i > 0 && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-light)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  )}
                  {i < crumbs.length - 1 ? (
                    <Link
                      href={crumb.href}
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap",
                        textDecoration: "none",
                        transition: "color .15s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = "var(--primary)")}
                      onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {crumb.label}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          ) : (
            <h2 style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {title}
            </h2>
          )}
          {subtitle && !crumbs && (
            <p style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="topbar-right">
        {/* Date chip — Calendar icon instead of emoji */}
        {dateStr && (
          <span className="topbar-date">
            <Calendar size={12} style={{ flexShrink: 0 }} />
            {dateStr}
          </span>
        )}

        {/* Notification bell — links to expiring policies filter */}
        <Link
          href="/dashboard/customers?filter=expiring"
          className="topbar-bell"
          title={expiringCount > 0 ? `${expiringCount} policies expiring soon` : "No upcoming expirations"}
          aria-label="Expiring policies"
        >
          <Bell size={16} />
          {expiringCount > 0 && (
            <span className="bell-badge">{expiringCount > 99 ? "99+" : expiringCount}</span>
          )}
        </Link>

        {/* User badge */}
        {session?.user && (
          <div className="user-badge">
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <div className="user-name">{session.user.name}</div>
              <div className="user-agency">
                {(session.user as { agencyName?: string }).agencyName ?? "Agent"}
              </div>
            </div>
          </div>
        )}

        {/* Logout */}
        <button onClick={handleLogout} title="Logout" className="logout-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span className="logout-btn-text">Logout</span>
        </button>
      </div>
    </header>
  );
}
