/** Display COA expiry (`YYYY-MM-DD` → `DD/MM/YYYY`, no timezone shift). */
export function formatCoaExpiryDisplay(iso?: string | null): string {
  if (!iso?.trim()) return "";
  const s = iso.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const [, y, mo, d] = m;
    return `${d}/${mo}/${y}`;
  }
  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return s;
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}
