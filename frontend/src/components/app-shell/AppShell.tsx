// Application shell: dark navigation rail, a persistent environment banner and
// a light working canvas. The banner never disappears, because every screen in
// this build is reading simulated bank evidence.

import {
  Bell,
  ChevronRight,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

import { useUnreadCount } from "../../lib/api/hooks";
import { useSession } from "../../lib/auth/session";
import { titleCase } from "../../lib/format";
import { BREADCRUMB_LABELS, navigationFor } from "./navigation";

function EnvironmentBanner() {
  const { meta } = useSession();
  if (!meta) return null;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-warning/30 bg-warning-soft px-4 py-2 text-[13px] text-warning sm:px-6"
    >
      <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide">
        {meta.environment === "production" ? "Restricted" : "Demo environment"}
      </span>
      <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide">
        Bank: {meta.bank_provider === "MOCK_BANK" ? "simulated" : meta.bank_provider}
      </span>
      {/* The full sentence needs room; on a phone the pills plus a short line
          carry the same warning without pushing the page off screen. */}
      <span className="hidden min-w-0 flex-1 sm:inline">
        Simulated bank responses and synthetic records. Not connected to any bank or AICTE
        production system, and no funds are moved.
      </span>
      <span className="min-w-0 flex-1 sm:hidden">Synthetic records · no funds are moved.</span>
    </div>
  );
}

function Breadcrumbs() {
  const { pathname } = useLocation();
  const segments = pathname.split("/").filter(Boolean);
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-[13px] text-ink-muted">
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          const label =
            BREADCRUMB_LABELS[segment] ??
            (segment.length > 12 ? `${segment.slice(0, 8)}…` : titleCase(segment));
          return (
            <li key={`${segment}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 && <ChevronRight aria-hidden="true" className="size-3.5 shrink-0" />}
              <span className={isLast ? "truncate font-medium text-ink" : "truncate"}>{label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, signOut } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const unread = useUnreadCount();

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  if (!session) return null;

  const sections = navigationFor(session.workspace);
  const searchBase = session.workspace === "institution" ? "/institution/fdrs" : "/official/fdrs";
  const notificationsPath =
    session.workspace === "institution" ? "/institution/notifications" : "/official/notifications";

  const navigation = (
    <nav aria-label="Primary navigation" className="space-y-6 px-3 py-4">
      {sections.map((section) => (
        <div key={section.heading}>
          <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/45">
            {section.heading}
          </p>
          <ul className="space-y-0.5">
            {section.items
              .filter((item) => !item.capability || session.capabilities.includes(item.capability))
              .map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to.endsWith("/new") || item.to.endsWith("overview")}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-sidebar-active text-white"
                          : "text-white/75 hover:bg-white/10 hover:text-white"
                      }`
                    }
                  >
                    <item.icon aria-hidden="true" className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.badgeKey === "notifications" && (unread.data?.unread ?? 0) > 0 && (
                      <span className="rounded-full bg-warning px-1.5 text-[11px] font-bold text-white">
                        {unread.data?.unread}
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <aside
        aria-label="Portal sections"
        className="hidden min-h-screen flex-col bg-sidebar text-white lg:flex"
      >
        <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
          <ShieldCheck aria-hidden="true" className="size-6 text-white/90" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">KoshSetu</p>
            <p className="truncate text-[11px] text-white/55">Security deposit &amp; FDR portal</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{navigation}</div>
        <div className="border-t border-white/10 px-4 py-3 text-[11px] text-white/55">
          <p>SIH26265 prototype</p>
          <p className="mt-0.5">Synthetic data only</p>
        </div>
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="flex w-72 max-w-[85%] flex-col bg-sidebar text-white"
            role="dialog"
            aria-modal="true"
            aria-label="Portal sections"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-sm font-semibold">KoshSetu</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded p-1.5 text-white/80 hover:bg-white/10"
              >
                <X aria-hidden="true" className="size-5" />
                <span className="sr-only">Close navigation</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{navigation}</div>
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            className="flex-1 bg-ink/50"
            onClick={() => setDrawerOpen(false)}
          />
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <EnvironmentBanner />

        <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur-sm">
          <div className="flex items-center gap-3 px-4 py-2.5 sm:px-6">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg border border-line p-2 lg:hidden"
            >
              <Menu aria-hidden="true" className="size-4" />
              <span className="sr-only">Open navigation</span>
            </button>

            <div className="min-w-0 flex-1">
              <Breadcrumbs />
            </div>

            <form
              role="search"
              className="hidden items-center md:flex"
              onSubmit={(event) => {
                event.preventDefault();
                navigate(`${searchBase}?q=${encodeURIComponent(search)}`);
              }}
            >
              <label htmlFor="global-search" className="sr-only">
                Search deposits by institution, AICTE id, masked reference or bank
              </label>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-ink-muted"
                />
                <input
                  id="global-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search institution, AICTE id, bank"
                  className="w-64 rounded-lg border border-line bg-surface py-2 pl-8 pr-3 text-sm"
                />
              </div>
            </form>

            <Link
              to={notificationsPath}
              className="relative rounded-lg border border-line p-2 text-ink-muted hover:bg-subtle"
            >
              <Bell aria-hidden="true" className="size-4" />
              <span className="sr-only">
                Notifications{unread.data?.unread ? `, ${unread.data.unread} unread` : ""}
              </span>
              {(unread.data?.unread ?? 0) > 0 && (
                <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-warning px-1 text-[10px] font-bold leading-4 text-white">
                  {unread.data?.unread}
                </span>
              )}
            </Link>

            <div className="hidden text-right sm:block">
              <p className="max-w-44 truncate text-sm font-medium text-ink">{session.display_name}</p>
              <p className="max-w-44 truncate text-[11px] text-ink-muted">
                {session.roles.map((role) => titleCase(role)).join(", ")}
              </p>
            </div>

            <button
              type="button"
              onClick={() => signOut().then(() => navigate("/login"))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-2 text-sm font-medium text-ink-muted hover:bg-subtle"
            >
              <LogOut aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        <main id="main-content" className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          {children}
        </main>

        <footer className="border-t border-line px-4 py-4 text-xs text-ink-muted sm:px-6 lg:px-8">
          <p>
            KoshSetu — prototype for SIH26265 “Streamline of security deposit / FDR portal”.
            Not an official AICTE website. All records, clearances and bank responses shown are
            synthetic.
          </p>
        </footer>
      </div>
    </div>
  );
}
