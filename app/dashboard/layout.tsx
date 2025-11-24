"use client";

import { useState, useEffect } from "react";
import SiteFooter from "../components/SiteFooter";
import DashboardHeader from "../components/DashboardHeader";
import DashboardSidebar from "../components/DashboardSidebar";
import { SaveBeforeSubmitModal } from "../components/SaveBeforeSubmitModal";
import { isPageSaved } from "../utils/draftStorage";

type RequiredPage = {
  key: string;
  label: string;
  path: string;
};

const REQUIRED_PAGES: RequiredPage[] = [
  { key: "saved-project-details", label: "Project Details", path: "/dashboard/project-details" },
  { key: "saved-applicant-details", label: "Applicant Details", path: "/dashboard/applicant" },
  { key: "saved-building-details", label: "Building Details", path: "/dashboard/building" },
  { key: "saved-area-details", label: "Area Details", path: "/dashboard/area" },
  { key: "saved-project-library", label: "Project Library", path: "/dashboard/project-library" },
  { key: "saved-bg-details", label: "BG Details", path: "/dashboard/bg" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sessionTime, setSessionTime] = useState(3600); // 60 minutes in seconds
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [missingPages, setMissingPages] = useState<RequiredPage[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSessionTime((prev) => {
        if (prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSubmitProjectClick = () => {
    const missing = REQUIRED_PAGES.filter((page) => !isPageSaved(page.key));
    if (missing.length > 0) {
      setMissingPages(missing);
      setIsSubmitModalOpen(true);
    } else {
      alert("All pages are saved. You can proceed to submit.");
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden relative">
      <DashboardHeader sessionTime={formatTime(sessionTime)} />
      <div className="flex flex-1 overflow-hidden">
        <DashboardSidebar
          collapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          onSubmitProjectClick={handleSubmitProjectClick}
        />
        <main className="flex-1 overflow-y-auto px-6 pt-6 bg-gray-100">{children}</main>
      </div>
      <SiteFooter />

      <SaveBeforeSubmitModal
        open={isSubmitModalOpen}
        missingPages={missingPages}
        onClose={() => setIsSubmitModalOpen(false)}
      />
    </div>
  );
}

