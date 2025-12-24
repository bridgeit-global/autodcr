"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

type DashboardSidebarProps = {
  collapsed: boolean;
  onToggleSidebar: () => void;
  onSubmitProjectClick: () => void;
};

const DashboardSidebar = ({ collapsed, onToggleSidebar, onSubmitProjectClick }: DashboardSidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get projectId from URL to preserve it when navigating
  const projectId = searchParams.get("projectId");
  const isEditMode = !!projectId;
  
  // Helper function to navigate while preserving projectId
  const handleNavigation = (path: string) => {
    const url = projectId ? `${path}?projectId=${projectId}` : path;
    router.push(url);
  };

  const menuItems = [
    {
      id: "project-details",
      label: "Project Details",
      path: "/dashboard/project-details",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7a2 2 0 012-2h5.172a2 2 0 011.414.586L13.414 7H19a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
          />
        </svg>
      ),
    },
    {
      id: "applicant-details",
      label: "Applicant Details",
      path: "/dashboard/applicant",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
    },
    {
      id: "building-details",
      label: "Building Details",
      path: "/dashboard/building",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 21h18M5 21V7a2 2 0 012-2h4v16M13 21V5h4a2 2 0 012 2v14"
          />
        </svg>
      ),
    },
    {
      id: "area-details",
      label: "Area Details",
      path: "/dashboard/area",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 10h18M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 14h2M11 14h2M15 14h2M7 17h2M11 17h2M15 17h2" />
        </svg>
      ),
    },
    {
      id: "project-library",
      label: "Project Library",
      path: "/dashboard/project-library",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 8h6M9 12h6M9 16h4" />
        </svg>
      ),
    },
    {
      id: "bg-details",
      label: "BG Details",
      path: "/dashboard/bg",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3l7 4v6c0 5-3 8-7 8s-7-3-7-8V7l7-4z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4"
          />
        </svg>
      ),
    },
  ];

  // Narrow sidebar on small screens; expand only on md+ for better mobile layout
  const sidebarWidthClass = collapsed ? "w-12 md:w-16" : "w-16 md:w-64";

  return (
    <aside
      className={`${sidebarWidthClass} bg-white transition-all duration-200 flex flex-col h-full`}
    >
      <div className="p-4 flex flex-col h-full">
        {/* Title + toggle */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          {!collapsed && <h2 className="hidden md:block text-lg font-bold text-gray-900">{isEditMode ? "EDIT PROJECT" : "CREATE PROJECT"}</h2>}
          <button
            type="button"
            onClick={onToggleSidebar}
            className="flex items-center justify-center hover:opacity-80 transition-opacity"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span
              className="w-8 h-8 flex items-center justify-center bg-emerald-100 rounded-lg text-emerald-700 shrink-0"
              aria-hidden="true"
            >
              <Image
                src="/show-sidebar-horiz.svg"
                alt=""
                width={20}
                height={20}
                className={`transition-transform ${collapsed ? "" : "rotate-180"}`}
              />
            </span>
          </button>
        </div>

        {/* Submit Project Button (hidden when sidebar is collapsed or on small screens) */}
        {!collapsed && (
          <button
            type="button"
            onClick={onSubmitProjectClick}
            className="hidden md:block w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-xl mb-6 transition-colors text-sm shadow-sm shrink-0"
          >
            {isEditMode ? "Update Project" : "Submit Project"}
          </button>
        )}

        {/* Navigation Items - Scrollable */}
        <nav className="space-y-1 flex-1 overflow-y-auto min-h-0">
          {menuItems.map((item) => {
            // Normalize paths by removing trailing slashes for comparison
            const normalizedPathname = pathname.replace(/\/$/, "");
            const normalizedItemPath = item.path.replace(/\/$/, "");
            
            const isActive = normalizedPathname === normalizedItemPath;

            const justifyClass = collapsed ? "justify-center" : "justify-between";

            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.path)}
                className={`relative w-full flex items-center ${justifyClass} px-4 py-3 rounded-xl transition-colors ${
                  isActive ? "bg-emerald-100 text-emerald-800" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-emerald-600" />
                )}
                <span className="text-sm font-medium flex items-center gap-2">
                  <span
                    className="w-8 h-8 flex items-center justify-center bg-emerald-100 rounded-lg text-emerald-700 shrink-0"
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                  {!collapsed && <span>{item.label}</span>}
                </span>
                {!collapsed && (
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};

export default DashboardSidebar;

