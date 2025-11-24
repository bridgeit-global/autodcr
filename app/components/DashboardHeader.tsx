"use client";

import { useState } from "react";

interface DashboardHeaderProps {
  sessionTime: string;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

const DashboardHeader = ({ sessionTime }: DashboardHeaderProps) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header className="w-full bg-sky-700 text-white shadow-md">
      <div className="mx-auto flex max-w-full items-center justify-between gap-4 px-6 py-3">
        {/* Left: Session Timer */}
        <div className="text-sm font-medium">
          Session Ends In: <span className="font-bold">{sessionTime}</span>
        </div>

        {/* Center: Branding */}
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold">AutoDCR</span>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center">
              <span className="text-xs text-sky-700 font-bold">BMC</span>
            </div>
            <span className="text-sm">Brihanmumbai Municipal Corporation</span>
          </div>
          <span className="text-sm font-semibold">BMC</span>
        </div>

        {/* Right: User Info & Actions */}
        <div className="flex items-center gap-4">
          {/* Calendar Icon */}
          <button className="p-2 hover:bg-sky-800 rounded transition-colors">
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
          <button className="p-2 hover:bg-sky-800 rounded transition-colors relative">
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
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 hover:bg-sky-800 px-3 py-2 rounded transition-colors"
            >
              <div className="text-right">
                <div className="text-sm font-medium">Sana N Malik Shaikh</div>
                <div className="text-xs text-gray-300">Architect</div>
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
                <a
                  href="#"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Profile
                </a>
                <a
                  href="#"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Settings
                </a>
                <a
                  href="#"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Logout
                </a>
              </div>
            )}
          </div>

          {/* Help Desk */}
          <div className="text-sm text-gray-300">Help Desk</div>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;

