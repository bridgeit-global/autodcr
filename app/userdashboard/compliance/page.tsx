"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import ComplianceClient from "./ComplianceClient";

export default function CompliancePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-0 flex-1 items-center justify-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin text-brand-blue" />
          Loading…
        </div>
      }
    >
      <ComplianceClient />
    </Suspense>
  );
}
