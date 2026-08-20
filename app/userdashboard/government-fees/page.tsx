import { Suspense } from "react";
import GovernmentFeesClient from "./GovernmentFeesClient";

export default function GovernmentFeesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[320px] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-brand-blue" />
        </div>
      }
    >
      <GovernmentFeesClient />
    </Suspense>
  );
}
