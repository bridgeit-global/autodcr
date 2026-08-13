"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown } from "lucide-react";
import { supabase } from "@/app/utils/supabase";
import { useUserMetadata } from "@/app/contexts/UserContext";
import ChangePasswordModal from "@/app/components/ChangePasswordModal";
import ProfileModal from "@/app/components/ProfileModal";
import DscSignerInstallModal from "@/app/components/DscSignerInstallModal";
import { AppSidebarMobileTrigger } from "./AppSidebar";

type AppHeaderProps = {
  title: string;
  onOpenMobileSidebar: () => void;
};

function formatUserName(userMetadata: Record<string, unknown> | null): string {
  if (!userMetadata || Object.keys(userMetadata).length === 0) return "User";
  const firstName = (userMetadata.first_name as string) || "";
  const middleName = (userMetadata.middle_name as string) || "";
  const lastName = (userMetadata.last_name as string) || "";
  const nameParts = [firstName, middleName, lastName].filter(Boolean);
  return nameParts.length > 0 ? nameParts.join(" ") : "User";
}

function getUserRole(userMetadata: Record<string, unknown> | null): string {
  if (!userMetadata || Object.keys(userMetadata).length === 0) return "";
  if (userMetadata.consultant_type) return String(userMetadata.consultant_type);
  if (userMetadata.role) return String(userMetadata.role);
  return "";
}

export default function AppHeader({ title, onOpenMobileSidebar }: AppHeaderProps) {
  const router = useRouter();
  const { clearUserMetadata, userMetadata, fetchUserMetadata, loading } = useUserMetadata();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isDscSignerInstallOpen, setIsDscSignerInstallOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const consultantUserId = localStorage.getItem("consultantUserId");
    const isEmpty =
      !userMetadata || (typeof userMetadata === "object" && Object.keys(userMetadata).length === 0);
    if (consultantUserId && isEmpty && !loading) {
      void fetchUserMetadata();
    }
  }, [userMetadata, loading, fetchUserMetadata]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [userMenuOpen]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut({ scope: "global" });
      clearUserMetadata();
      ["consultantId", "consultantUserId", "consultantType", "userMetadata"].forEach((key) =>
        localStorage.removeItem(key)
      );
      Object.keys(localStorage).forEach((key) => {
        if (
          key.startsWith("sb-") ||
          key.startsWith("draft-") ||
          key.startsWith("saved-") ||
          key.startsWith("baseline-") ||
          key.startsWith("dirty-")
        ) {
          localStorage.removeItem(key);
        }
      });
      sessionStorage.clear();
      setUserMenuOpen(false);
      router.push("/login");
    } catch (error) {
      console.error("Error during logout:", error);
      router.push("/login");
    }
  };

  const displayName = formatUserName(userMetadata);
  const role = getUserRole(userMetadata) || "User";

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <AppSidebarMobileTrigger onClick={onOpenMobileSidebar} />

          <h1 className="hidden shrink-0 text-base font-bold text-brand-navy sm:block md:text-lg">
            {title}
          </h1>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="relative flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-status-danger" />
            </button>

            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-gray-100 sm:gap-3 sm:px-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-navy text-xs font-semibold text-white">
                  {displayName.slice(0, 1).toUpperCase()}
                </div>
                <div className="hidden text-left leading-tight sm:block">
                  <div className="text-sm font-medium text-gray-900">{displayName}</div>
                  <div className="text-xs text-gray-500">{role}</div>
                </div>
                <ChevronDown
                  className={[
                    "hidden h-4 w-4 text-gray-400 transition-transform sm:block",
                    userMenuOpen ? "rotate-180" : "",
                  ].join(" ")}
                />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(true);
                      setUserMenuOpen(false);
                    }}
                    className="block w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangePasswordOpen(true);
                      setUserMenuOpen(false);
                    }}
                    className="block w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Change Password
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDscSignerInstallOpen(true);
                      setUserMenuOpen(false);
                    }}
                    className="block w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Install DSC Signer
                  </button>
                  <div className="my-1 border-t border-gray-100" />
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="block w-full px-4 py-2.5 text-left text-sm text-status-danger hover:bg-red-50"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <ChangePasswordModal
        open={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
      <ProfileModal open={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      <DscSignerInstallModal
        open={isDscSignerInstallOpen}
        onClose={() => setIsDscSignerInstallOpen(false)}
      />
    </>
  );
}
