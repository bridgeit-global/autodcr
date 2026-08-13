import {
  LayoutDashboard,
  FolderKanban,
  FileStack,
  Building2,
  ClipboardList,
  FileText,
  PenTool,
  Users,
  ShieldCheck,
  CheckSquare,
  Wallet,
  BookOpen,
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
    id: "authority-workspace",
    label: "Authority Workspace",
    href: "/userdashboard/authority-workspace",
    icon: Building2,
  },
  {
    id: "requirements",
    label: "Requirements",
    href: "/userdashboard/requirements",
    icon: ClipboardList,
  },
  {
    id: "documents",
    label: "Documents",
    href: "/userdashboard/documents",
    icon: FileText,
  },
  {
    id: "drawings",
    label: "Drawings",
    href: "/userdashboard/drawings",
    icon: PenTool,
  },
  {
    id: "consultants",
    label: "Consultants",
    href: "/userdashboard/consultants",
    icon: Users,
  },
  {
    id: "compliance",
    label: "Compliance",
    href: "/userdashboard/compliance",
    icon: ShieldCheck,
  },
  {
    id: "approvals",
    label: "Approvals",
    href: "/userdashboard/approvals",
    icon: CheckSquare,
  },
  {
    id: "government-fees",
    label: "Government Fees",
    href: "/userdashboard/government-fees",
    icon: Wallet,
  },
  {
    id: "knowledge-centre",
    label: "Knowledge Centre",
    href: "/userdashboard/knowledge-centre",
    icon: BookOpen,
  },
];
