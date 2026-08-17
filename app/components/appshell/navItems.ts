import {
  LayoutDashboard,
  FolderKanban,
  FileStack,
  FileText,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AppNavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** When true, this route is live; otherwise it shows the placeholder page. */
  live?: boolean;
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/userdashboard",
    icon: LayoutDashboard,
    live: true,
  },
  {
    id: "projects",
    label: "Projects",
    href: "/userdashboard/legacy",
    icon: FolderKanban,
    live: true,
  },
  {
    id: "applications",
    label: "Applications",
    href: "/userdashboard/applications",
    icon: FileStack,
    live: true,
  },
  {
    id: "documents",
    label: "Documents",
    href: "/userdashboard/documents",
    icon: FileText,
    live: true,
  },
  {
    id: "administration",
    label: "Administration",
    href: "/userdashboard/administration",
    icon: Users,
    live: true,
  },
];
