"use client";

import { type ReactNode, useState } from "react";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";

type AppShellProps = {
  title: string;
  children: ReactNode;
};

export default function AppShell({ title, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden bg-surface">
      <AppSidebar
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppHeader title={title} onOpenMobileSidebar={() => setMobileOpen(true)} />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          {children}
        </main>
      </div>
    </div>
  );
}
