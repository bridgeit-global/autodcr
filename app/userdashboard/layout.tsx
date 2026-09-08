"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import AppShell from "@/app/components/appshell/AppShell";
import { APP_NAV_ITEMS } from "@/app/components/appshell/navItems";
import { useUserMetadata } from "@/app/contexts/UserContext";

function resolvePageTitle(pathname: string, role: string): string {
  if (pathname === "/userdashboard") {
    return role ? `${role} Dashboard` : "Dashboard";
  }
  if (pathname.startsWith("/userdashboard/legacy")) {
    return "Projects";
  }
  if (pathname.startsWith("/userdashboard/help-desk")) {
    return "Help Desk";
  }
  const match = APP_NAV_ITEMS.find(
    (item) => item.href !== "/userdashboard" && pathname.startsWith(item.href)
  );
  return match?.label ?? "Draft Desk";
}

export default function UserDashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/userdashboard";
  const { userMetadata } = useUserMetadata();
  const role =
    (userMetadata?.consultant_type as string) || (userMetadata?.role as string) || "";
  const title = resolvePageTitle(pathname, role);

  return <AppShell title={title}>{children}</AppShell>;
}
