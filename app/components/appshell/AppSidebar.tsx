"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, PanelLeftClose, PanelLeft, X } from "lucide-react";
import { APP_NAV_ITEMS } from "./navItems";
import { useDashboardProjects } from "@/app/hooks/useDashboardProjects";

type AppSidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

function isActivePath(pathname: string, href: string) {
  if (href === "/userdashboard") {
    return pathname === "/userdashboard";
  }
  // Create / edit project wizard lives under /dashboard — highlight Projects
  if (href === "/userdashboard/legacy") {
    return (
      pathname === href ||
      pathname.startsWith(`${href}/`) ||
      pathname.startsWith("/dashboard")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppSidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: AppSidebarProps) {
  const pathname = usePathname() || "/userdashboard";
  const { isConsultant } = useDashboardProjects();

  const visibleNavItems = APP_NAV_ITEMS.filter((item) => {
    if (!item.audience) return true;
    if (isConsultant) return item.audience === "consultant";
    return item.audience === "owner";
  });

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-3">
      {visibleNavItems.map((item) => {
        const active = isActivePath(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={onCloseMobile}
            title={collapsed ? item.label : undefined}
            className={[
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-white/10 text-white"
                : "text-slate-300 hover:bg-white/5 hover:text-white",
              collapsed ? "justify-center px-2" : "",
            ].join(" ")}
          >
            <Icon
              className={[
                "h-5 w-5 shrink-0",
                active ? "text-blue-300" : "text-slate-400 group-hover:text-slate-200",
              ].join(" ")}
            />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );

  const logoBlock = (
    <div
      className={[
        "flex items-center border-b border-white/10 px-3 py-4",
        collapsed ? "justify-center" : "justify-between gap-2",
      ].join(" ")}
    >
      <Link
        href="/userdashboard"
        onClick={onCloseMobile}
        className="flex items-center gap-2"
        aria-label="Draft Desk home"
      >
        <span className="inline-flex rounded-lg bg-white px-2 py-1.5">
          <Image
            src="/draft-desk-logo.png"
            alt="Draft Desk"
            width={120}
            height={48}
            className={collapsed ? "h-7 w-auto object-contain" : "h-8 w-auto object-contain"}
            priority
          />
        </span>
      </Link>
      {!collapsed && (
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="hidden h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white lg:flex"
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-label="Close menu"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-brand-navy transition-transform duration-200 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-4">
          <Link href="/userdashboard" onClick={onCloseMobile} className="flex items-center">
            <span className="inline-flex rounded-lg bg-white px-2 py-1.5">
              <Image
                src="/draft-desk-logo.png"
                alt="Draft Desk"
                width={120}
                height={48}
                className="h-8 w-auto object-contain"
              />
            </span>
          </Link>
          <button
            type="button"
            onClick={onCloseMobile}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {nav}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={[
          "hidden shrink-0 flex-col bg-brand-navy transition-all duration-200 lg:flex",
          collapsed ? "w-[4.5rem]" : "w-64",
        ].join(" ")}
      >
        {logoBlock}
        {collapsed && (
          <div className="flex justify-center border-b border-white/10 py-2">
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Expand sidebar"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          </div>
        )}
        {nav}
      </aside>
    </>
  );
}

export function AppSidebarMobileTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-lg text-brand-navy transition-colors hover:bg-gray-100 lg:hidden"
      aria-label="Open menu"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
