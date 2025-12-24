import { Suspense } from "react";
import ProjectDetailsClient from "./ProjectDetailsClient";

export default function ProjectDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto px-6 pt-8 space-y-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading...</p>
            </div>
          </div>
        </div>
      }
    >
      <ProjectDetailsClient />
    </Suspense>
  );
}


