"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/utils/supabase";
import ChangePasswordModal from "./ChangePasswordModal";
import ProfileModal from "./ProfileModal";
import { useUserMetadata } from "@/app/contexts/UserContext";

interface DashboardHeaderProps {
  sessionTime: string;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

const DashboardHeader = ({ sessionTime }: DashboardHeaderProps) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const { clearUserMetadata, userMetadata, fetchUserMetadata, loading } = useUserMetadata();

  // Fetch metadata if it's not loaded or is empty
  useEffect(() => {
    const consultantUserId = localStorage.getItem("consultantUserId");
    // Check if metadata is null or empty object
    const isEmpty = !userMetadata || (typeof userMetadata === 'object' && Object.keys(userMetadata).length === 0);
    if (consultantUserId && isEmpty && !loading) {
      fetchUserMetadata();
    }
  }, [userMetadata, loading, fetchUserMetadata]);

  // Format name as last_name first_name middle_name
  const formatUserName = () => {
    if (!userMetadata || Object.keys(userMetadata).length === 0) {
      return "User";
    }
    
    const lastName = userMetadata.last_name || "";
    const firstName = userMetadata.first_name || "";
    const middleName = userMetadata.middle_name || "";
    
    const nameParts = [lastName, firstName, middleName].filter(Boolean);
    return nameParts.length > 0 ? nameParts.join(" ") : "User";
  };

  // Get user role/consultant type
  const getUserRole = () => {
    if (!userMetadata || Object.keys(userMetadata).length === 0) {
      return "";
    }
    
    // Check for consultant_type first (for consultants)
    if (userMetadata.consultant_type) {
      return userMetadata.consultant_type;
    }
    
    // Check for role (for owners/developers)
    if (userMetadata.role) {
      return userMetadata.role;
    }
    
    return "";
  };

  const handleLogout = async () => {
    try {
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Clear user metadata from context
      clearUserMetadata();
      
      // Clear localStorage items
      localStorage.removeItem('consultantId');
      localStorage.removeItem('consultantUserId');
      localStorage.removeItem('consultantType');
      localStorage.removeItem('userMetadata');
      
      // Close the dropdown menu
      setUserMenuOpen(false);
      
      // Navigate to landing page
      router.push('/');
    } catch (error) {
      console.error('Error during logout:', error);
      // Still navigate to landing page even if logout fails
      router.push('/');
    }
  };

  // Close dropdown on outside click / Escape
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
      if (e.key === "Escape") {
        setUserMenuOpen(false);
      }
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

  return (
    <header className="w-full text-gray-900">
      {/* Rounded navbar container (matches dashboard styling) */}
      <div className="w-full">
        <div className="bg-white border border-gray-200 rounded-3xl shadow-sm">
          <div className="flex max-w-full items-center justify-between gap-4 px-6 py-4">
        {/* Left: Branding */}
        <div className="flex items-center gap-3 min-w-[180px]">
          <div className="h-9 w-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow-sm">
            <span className="text-sm text-white font-bold">DD</span>
        </div>
          <div className="leading-tight">
            <div className="text-base font-semibold">Draft Desk</div>
            <div className="text-xs text-gray-500">Create Project Dashboard</div>
          </div>
        </div>

        {/* Center: (Search removed as requested) */}
        <div className="hidden md:flex flex-1 justify-center" />

        {/* Right: Session + actions + user */}
        <div className="flex items-center gap-3 min-w-[220px] justify-end">
          {/* Session Timer */}
          <div className="hidden lg:block text-xs text-gray-500">
            Session: <span className="font-semibold text-gray-700">{sessionTime}</span>
          </div>

          {/* Calendar Icon */}
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Calendar">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </button>

          {/* Bell Icon */}
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative" aria-label="Notifications">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
          </button>

          {/* User Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-3 hover:bg-gray-100 px-3 py-2 rounded-xl transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-700">
                {formatUserName().slice(0, 1).toUpperCase()}
              </div>
              <div className="text-left leading-tight">
                <div className="text-sm font-medium text-gray-900">{formatUserName()}</div>
                <div className="text-xs text-gray-500">{getUserRole() || "User"}</div>
              </div>
              <svg
                className={`w-4 h-4 transition-transform ${
                  userMenuOpen ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    router.push("/userdashboard");
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Go to Dashboard
                </button>
                <button
                  onClick={() => {
                    setIsProfileOpen(true);
                    setUserMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Profile
                </button>
                <button
                  onClick={() => {
                    setIsChangePasswordOpen(true);
                    setUserMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Change Password
                </button>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Logout
                </button>
              </div>
            )}
          </div>

          {/* Help Desk */}
          <div className="hidden lg:block text-sm text-gray-500">Help Desk</div>
        </div>
          </div>
        </div>
      </div>
      
      {/* Change Password Modal */}
      <ChangePasswordModal
        open={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
      
      {/* Profile Modal */}
      <ProfileModal
        open={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </header>
  );
};

export default DashboardHeader;

