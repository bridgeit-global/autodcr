"use client";

import React, { useState, useEffect } from "react";
import DashboardHeader from "../components/DashboardHeader";
import SiteFooter from "../components/SiteFooter";

export default function CreateApplicationPage() {
  const [sessionTime, setSessionTime] = useState(3600); // 60 minutes in seconds

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

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <DashboardHeader sessionTime={formatTime(sessionTime)} />
      
      <div className="flex-1 overflow-y-auto bg-gray-100">
        <div className="max-w-6xl mx-auto px-6 pt-8 space-y-6">
          <section className="border border-black rounded-lg bg-white flex flex-col max-h-[70vh] overflow-hidden">
            <div className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-4 border-b border-black px-6 py-4 bg-white">
              <div>
                <h2 className="text-xl font-bold text-black">Create New Application</h2>
                <p className="text-sm text-gray-700 mt-1">
                  Create a new application for your project.
                </p>
              </div>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto pb-6">
              <div className="text-center text-gray-600 py-12">
                <p className="text-lg">Application creation form will be displayed here.</p>
                <p className="text-sm mt-2">This page is ready for implementation.</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

