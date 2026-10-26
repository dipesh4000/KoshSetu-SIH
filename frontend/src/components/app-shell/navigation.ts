// Navigation is generated from the capabilities the server reported for this
// session. A hidden link is a convenience, not an access control.

import {
  Bell,
  ClipboardList,
  FileSearch,
  FileStack,
  FolderOpen,
  Gauge,
  HelpCircle,
  History,
  Inbox,
  Landmark,
  LayoutDashboard,
  Repeat2,
  ScrollText,
  ShieldAlert,
  Table2,
  Timer,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  capability?: string;
  badgeKey?: "notifications";
  description?: string;
}

export interface NavSection {
  heading: string;
  items: NavItem[];
}

export const INSTITUTION_NAV: NavSection[] = [
  {
    heading: "Workspace",
    items: [
      { to: "/institution/overview", label: "Overview", icon: LayoutDashboard },
      { to: "/institution/fdrs", label: "My deposits", icon: Landmark, capability: "fdr:read" },
      {
        to: "/institution/fdrs/new",
        label: "New submission",
        icon: ClipboardList,
        capability: "fdr:draft",
      },
      { to: "/institution/renewals", label: "Renewal / replacement", icon: Repeat2, capability: "fdr:read" },
      {
        to: "/institution/releases",
        label: "Release requests",
        icon: FolderOpen,
        capability: "release:read",
      },
      { to: "/institution/documents", label: "Documents", icon: FileStack, capability: "document:read" },
    ],
  },
  {
    heading: "Updates",
    items: [
      {
        to: "/institution/notifications",
        label: "Notifications",
        icon: Bell,
        capability: "notification:read",
        badgeKey: "notifications",
      },
      { to: "/institution/activity", label: "Activity", icon: History, capability: "fdr:read" },
      { to: "/help", label: "Help", icon: HelpCircle },
    ],
  },
];

export const OFFICIAL_NAV: NavSection[] = [
  {
    heading: "Portfolio",
    items: [
      { to: "/official/overview", label: "Overview", icon: Gauge },
      { to: "/official/queue", label: "Work queue", icon: Inbox, capability: "fdr:review" },
      { to: "/official/fdrs", label: "All deposits", icon: Table2, capability: "fdr:read_all" },
      { to: "/official/maturities", label: "Maturity centre", icon: Timer, capability: "fdr:read" },
    ],
  },
  {
    heading: "Decisions",
    items: [
      { to: "/official/releases", label: "Release centre", icon: FolderOpen, capability: "release:read" },
      {
        to: "/official/exceptions",
        label: "Integrity & action needed",
        icon: ShieldAlert,
        capability: "finding:read",
      },
    ],
  },
  {
    heading: "Oversight",
    items: [
      { to: "/official/reports", label: "Reports", icon: FileSearch, capability: "report:read" },
      { to: "/official/audit", label: "Audit explorer", icon: ScrollText, capability: "audit:read" },
      {
        to: "/official/notifications",
        label: "Notifications",
        icon: Bell,
        capability: "notification:read",
        badgeKey: "notifications",
      },
      { to: "/help", label: "Help", icon: HelpCircle },
    ],
  },
];

export const ADMIN_NAV: NavSection[] = [
  {
    heading: "Administration",
    items: [
      { to: "/admin/overview", label: "System health", icon: Gauge },
      { to: "/admin/rules", label: "Rule versions", icon: ShieldAlert, capability: "finding:read" },
      { to: "/official/audit", label: "Audit explorer", icon: ScrollText, capability: "audit:read" },
      { to: "/help", label: "Help", icon: HelpCircle },
    ],
  },
];

export function navigationFor(workspace: string): NavSection[] {
  if (workspace === "institution") return INSTITUTION_NAV;
  if (workspace === "admin") return ADMIN_NAV;
  return OFFICIAL_NAV;
}

export const BREADCRUMB_LABELS: Record<string, string> = {
  institution: "Institution",
  official: "AICTE",
  admin: "Administration",
  overview: "Overview",
  fdrs: "Deposits",
  new: "New submission",
  renewals: "Renewal / replacement",
  releases: "Release requests",
  documents: "Documents",
  notifications: "Notifications",
  activity: "Activity",
  queue: "Work queue",
  maturities: "Maturity centre",
  exceptions: "Integrity & action needed",
  reports: "Reports",
  audit: "Audit explorer",
  rules: "Rule versions",
  help: "Help",
};
