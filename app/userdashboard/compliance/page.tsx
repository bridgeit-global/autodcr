"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import ComplianceClient from "./ComplianceClient";

export default function CompliancePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4">
          <Loader2 className="h-5 w-5 animate-spin text-brand-blue" />
          <p className="text-sm text-gray-500">Loading compliance…</p>
        </div>
      }
    >
      <ComplianceClient />
    </Suspense>
  );
}
