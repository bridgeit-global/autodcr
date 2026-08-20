import {
  Briefcase,
  ClipboardCheck,
  DraftingCompass,
  LayoutDashboard,
  FolderKanban,
  FileStack,
  FileText,
  IndianRupee,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AppNavAudience = "owner" | "consultant";

export type AppNavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** When true, this route is live; otherwise it shows the placeholder page. */
  live?: boolean;
  /** When set, item is shown only to that role. Omit for shared items. */
  audience?: AppNavAudience;
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
    id: "owner-workspace",
    label: "Owner Workspace",
    href: "/userdashboard/owner-workspace",
    icon: ClipboardCheck,
    live: true,
    audience: "owner",
  },
  {
    id: "consultant-workspace",
    label: "Consultant Workspace",
    href: "/userdashboard/consultant-workspace",
    icon: Briefcase,
    live: true,
    audience: "consultant",
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
    id: "drawings",
    label: "Drawing Review",
    href: "/userdashboard/drawings",
    icon: DraftingCompass,
    live: true,
  },
  {
    id: "compliance",
    label: "Compliance",
    href: "/userdashboard/compliance",
    icon: ShieldCheck,
    live: true,
  },
  {
    id: "government-fees",
    label: "Government Fees",
    href: "/userdashboard/government-fees",
    icon: IndianRupee,
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
