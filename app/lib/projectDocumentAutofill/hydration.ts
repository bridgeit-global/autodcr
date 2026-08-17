export const PROJECT_LIBRARY_AUTOFILL_EVENT = "project-library-autofill-applied";

export function notifyProjectAutofillApplied(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PROJECT_LIBRARY_AUTOFILL_EVENT));
}

export function subscribeProjectAutofillApplied(onApplied: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => onApplied();
  window.addEventListener(PROJECT_LIBRARY_AUTOFILL_EVENT, handler);
  return () => window.removeEventListener(PROJECT_LIBRARY_AUTOFILL_EVENT, handler);
}
