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


