export const SESSION_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours
export const SESSION_EXPIRES_AT_KEY = "sessionExpiresAt";

export function getSessionExpiresAt(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_EXPIRES_AT_KEY);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function setSessionExpiresAt(expiresAt: number = Date.now() + SESSION_DURATION_MS): number {
  localStorage.setItem(SESSION_EXPIRES_AT_KEY, String(expiresAt));
  return expiresAt;
}

/** Ensure a deadline exists (e.g. legacy sessions after cookie migration). */
export function ensureSessionExpiresAt(): number {
  const existing = getSessionExpiresAt();
  if (existing != null) return existing;
  return setSessionExpiresAt();
}

export function clearSessionExpiresAt(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_EXPIRES_AT_KEY);
}

export function getRemainingSessionSeconds(expiresAt: number, now = Date.now()): number {
  return Math.max(0, Math.floor((expiresAt - now) / 1000));
}

/** Format remaining seconds as H:MM:SS (≥1h) or M:SS / MM:SS (<1h). */
export function formatSessionRemaining(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${m}:${pad(s)}`;
}
