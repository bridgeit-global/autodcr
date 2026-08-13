"use client";

import { type ReactNode, Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/app/components/appshell/AppShell";
import { APP_NAV_ITEMS } from "@/app/components/appshell/navItems";
import { useUserMetadata } from "@/app/contexts/UserContext";
import { supabase } from "@/app/utils/supabase";
import { sanitizeReturnUrl } from "@/app/utils/applicationDeepLink";

function resolvePageTitle(pathname: string, role: string): string {
  if (pathname === "/userdashboard") {
    return role ? `${role} Dashboard` : "Dashboard";
  }
  if (pathname.startsWith("/userdashboard/legacy")) {
    return "Projects";
  }
  const match = APP_NAV_ITEMS.find(
    (item) => item.href !== "/userdashboard" && pathname.startsWith(item.href)
  );
  return match?.label ?? "Draft Desk";
}

function UserDashboardLayoutInner({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/userdashboard";
  const searchParams = useSearchParams();
  const router = useRouter();
  const { userMetadata } = useUserMetadata();
  const [authState, setAuthState] = useState<"checking" | "authenticated" | "unauthenticated">(
    "checking"
  );

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (!session?.access_token) {
        const qs = searchParams.toString();
        const returnPath = sanitizeReturnUrl(qs ? `${pathname}?${qs}` : pathname);
        router.replace(`/login?returnUrl=${encodeURIComponent(returnPath)}`);
        setAuthState("unauthenticated");
        return;
      }
      setAuthState("authenticated");
    });
    return () => {
      cancelled = true;
    };
  }, [pathname, router, searchParams]);

  const role =
    (userMetadata?.consultant_type as string) || (userMetadata?.role as string) || "";
  const title = resolvePageTitle(pathname, role);

  if (authState === "checking") {
    return (
      <div className="flex h-dvh items-center justify-center bg-surface">
        <div className="text-center">
          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-brand-blue" />
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      </div>
    );
  }

  if (authState === "unauthenticated") {
    return null;
  }

  return <AppShell title={title}>{children}</AppShell>;
}

export default function UserDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center bg-surface">
          <div className="text-center">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-brand-blue" />
            <p className="text-sm text-gray-500">Loading…</p>
          </div>
        </div>
      }
    >
      <UserDashboardLayoutInner>{children}</UserDashboardLayoutInner>
    </Suspense>
  );
}
