"use client";

import { usePathname, useRouter } from "next/navigation";

type DashboardSidebarProps = {
  collapsed: boolean;
  onToggleSidebar: () => void;
  onSubmitProjectClick: () => void;
};

const DashboardSidebar = ({ collapsed, onToggleSidebar, onSubmitProjectClick }: DashboardSidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();

  const menuItems = [
    { id: "project-details", label: "Project Details", path: "/dashboard", icon: "📁" },
    { id: "applicant-details", label: "Applicant Details", path: "/dashboard/applicant", icon: "🧑‍💼" },
    { id: "building-details", label: "Building Details", path: "/dashboard/building", icon: "🏢" },
    { id: "area-details", label: "Area Details", path: "/dashboard/area", icon: "📐" },
    { id: "project-library", label: "Project Library", path: "/dashboard/project-library", icon: "📚" },
    { id: "bg-details", label: "BG Details", path: "/dashboard/bg", icon: "🏦" },
  ];

  // Narrow sidebar on small screens; expand only on md+ for better mobile layout
  const sidebarWidthClass = collapsed ? "w-12 md:w-16" : "w-16 md:w-64";

  return (
    <aside
      className={`${sidebarWidthClass} bg-white border-r border-gray-200 overflow-y-auto transition-all duration-200`}
    >
      <div className="p-4">
        {/* Title + toggle inline */}
        <div className="flex items-center justify-between mb-4">
          {/* Hide title on small screens */}
          {!collapsed && <h2 className="hidden md:block text-lg font-bold text-gray-800">CREATE PROJECT</h2>}
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={onToggleSidebar}
            className="flex items-center justify-center h-8 w-8 rounded-full bg-sky-700 text-white border border-sky-500 shadow-sm"
          >
            {collapsed ? ">" : "<"}
          </button>
        </div>

        {/* Submit Project Button (hidden when sidebar is collapsed or on small screens) */}
        {!collapsed && (
          <button
            type="button"
            onClick={onSubmitProjectClick}
            className="hidden md:block w-full bg-sky-700 hover:bg-sky-800 text-white font-semibold py-2 px-4 rounded mb-6 transition-colors text-sm"
          >
            Submit Project
          </button>
        )}

        {/* Navigation Items */}
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const isActive =
              pathname === item.path ||
              (item.path === "/dashboard" &&
                (pathname === "/dashboard" || pathname === "/dashboard/project-details"));

            const justifyClass = collapsed ? "justify-center" : "justify-between";

            return (
              <button
                key={item.id}
                onClick={() => router.push(item.path)}
                className={`w-full flex items-center ${justifyClass} px-4 py-3 rounded transition-colors ${
                  isActive ? "bg-orange-500 text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="text-sm font-medium flex items-center gap-2">
                  <span className="text-base" aria-hidden="true">
                    {item.icon}
                  </span>
                  {!collapsed && <span>{item.label}</span>}
                </span>
                {!collapsed && (
                  <svg
                    className="w-4 h-4"
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

