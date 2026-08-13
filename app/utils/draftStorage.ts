export function loadDraft<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Simple flags to track whether a page has been explicitly saved
export function markPageSaved(key: string) {
  saveDraft(key, { savedAt: Date.now() });
}

export function isPageSaved(key: string): boolean {
  const data = loadDraft<{ savedAt?: number } | null>(key, null);
  return !!(data && typeof data.savedAt === "number");
}


export function saveDraft<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / serialization errors for now
  }
}

// Clear all project-related drafts and "saved" flags.
// Call this when a project is submitted successfully or when leaving the dashboard.
export function clearProjectDrafts() {
  if (typeof window === "undefined") return;

  const keysToClear = [
    // Project details
    "draft-project-details-project",
    "draft-project-details-save-plot",
    "saved-project-details",
    "saved-project-info",
    "saved-save-plot-details",
    "saved-project-info-snapshot",
    "saved-save-plot-details-snapshot",
    "baseline-project-details-snapshot",

    // Applicant
    "draft-applicant-details-form",
    "draft-applicant-details-applicants",
    "saved-applicant-details",
    "saved-applicant-details-snapshot",
    "baseline-applicant-details-snapshot",

    // Building
    "draft-building-details-form",
    "saved-building-details",
    "saved-building-details-snapshot",
    "unsaved-building-details",
    "baseline-building-details-snapshot",

    // Area
    "draft-area-details-plots",
    "draft-area-details-totals",
    "saved-area-details",
    "saved-area-details-snapshot",
    "baseline-area-details-snapshot",

    // Project library
    "draft-project-library-uploads",
    "saved-project-library",
    "saved-project-library-snapshot",
    "baseline-project-library-snapshot",

    // BG details
    "draft-bg-details-form",
    "draft-bg-details-entries",
    "draft-bg-details-active-tab",
    "saved-bg-details",
    "saved-bg-details-snapshot",
    "baseline-bg-details-snapshot",
    "dirty-bg-details",
  ];

  try {
    keysToClear.forEach((key) => {
      window.localStorage.removeItem(key);
    });
  } catch {
    // ignore errors
  }
}



