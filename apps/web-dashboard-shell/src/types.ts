import type { ReactNode } from "react";

export type NavItem = {
  id: string;
  label: string;
  icon: ReactNode;
  to?: string;
  onClick?: () => void;
};

export type DashboardShellProps = {
  user?: {
    name?: string;
    role?: string;
    initials?: string;
  } | null;
  organization?: {
    name?: string;
    serviceName?: string;
    sub?: string;
  } | null;
  navItems: NavItem[];
  activeNavId?: string;
  topbarTitle: string;
  topbarSubtitle?: string;
  topbarRight?: ReactNode;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  sidebarFooter?: ReactNode;
  children: ReactNode;
};
