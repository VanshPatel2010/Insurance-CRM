"use client";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useState, useEffect } from "react";

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": {
    title: "Dashboard",
    subtitle: "Overview of all policies and alerts",
  },
  "/dashboard/customers": {
    title: "Customers",
    subtitle: "Manage all customer policies",
  },
  "/dashboard/customers/new": {
    title: "Add Customer",
    subtitle: "Create a new policy record",
  },
};

function getPageMeta(pathname: string) {
  if (pathname.match(/^\/dashboard\/customers\/[^/]+\/edit$/)) {
    return { title: "Edit Customer", subtitle: "Update policy details" };
  }
  if (pathname.match(/^\/dashboard\/customers\/[^/]+$/)) {
    return { title: "Customer Detail", subtitle: "Full policy information" };
  }
  return pageTitles[pathname] ?? { title: "InsureCRM", subtitle: "" };
}

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { title, subtitle } = getPageMeta(pathname);

  const [dateStr, setDateStr] = useState<string>("");

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
        {/* Always render the button; CSS hides it on desktop */}
        <button
          className="mobile-menu-btn"
          onClick={() => window.dispatchEvent(new Event("toggle-sidebar"))}
          aria-label="Toggle Navigation"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h2>
          {subtitle && <p style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</p>}
        </div>
      </div>

      <div className="topbar-right">
        {dateStr && <span className="topbar-date">📅 {dateStr}</span>}

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
        <button
          onClick={handleLogout}
          title="Logout"
          className="logout-btn"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
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
