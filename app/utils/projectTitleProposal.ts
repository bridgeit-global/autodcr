/**
 * Helpers for project title ↔ proposal number composition.
 * Stored `projects.title` is typically: `${baseTitle} ${proposalNo}`.
 */

export function stripTrailingProposalNo(
  title: string,
  proposalNo?: string | null
): string {
  let base = String(title || "").trim();
  const prop = String(proposalNo || "").trim();
  if (!prop) return base;
  const suffix = ` ${prop}`;
  while (base.endsWith(suffix)) {
    base = base.slice(0, -suffix.length).trimEnd();
  }
  if (base === prop) return "";
  return base;
}

/**
 * Strip every known proposal number from the end of a title (longest first),
 * repeating until none match. Fixes titles that accumulated multiple proposal nos.
 */
export function stripKnownProposalNosFromTitle(
  title: string,
  proposalNos: Array<string | null | undefined>
): string {
  let base = String(title || "").trim();
  const known = [
    ...new Set(
      proposalNos
        .map((p) => String(p || "").trim())
        .filter(Boolean)
    ),
  ].sort((a, b) => b.length - a.length);

  let guard = 0;
  while (guard++ < 30) {
    let stripped = false;
    for (const prop of known) {
      const suffix = ` ${prop}`;
      if (base.endsWith(suffix)) {
        base = base.slice(0, -suffix.length).trimEnd();
        stripped = true;
        break;
      }
      if (base === prop) {
        base = "";
        stripped = true;
        break;
      }
    }
    if (!stripped) break;
  }
  return base;
}

/**
 * Build stored project title as base + latest proposal no only.
 * Always overwrites any previous proposal no(s) listed in `previousProposalNos`.
 * If an older proposal appears mid-title (from past duplication), cuts from that point.
 */
export function combineProjectTitleWithProposalNo(
  title: string,
  proposalNo?: string | null,
  previousProposalNos: Array<string | null | undefined> = []
): string {
  const prop = String(proposalNo || "").trim();
  let base = String(title || "").trim();

  for (const prev of previousProposalNos) {
    const older = String(prev || "").trim();
    if (!older || older === prop) continue;
    const marker = ` ${older}`;
    const idx = base.indexOf(marker);
    if (idx !== -1) {
      base = base.slice(0, idx).trimEnd();
    }
  }

  base = stripKnownProposalNosFromTitle(base, [...previousProposalNos, prop]);
  return prop ? `${base} ${prop}`.trim() : base;
}

/** Base title for UI display (proposal shown separately or highlighted). */
export function getProjectBaseTitle(
  storedTitle: string,
  proposalNo?: string | null,
  infoTitle?: string | null
): string {
  const prop = String(proposalNo || "").trim();
  const fromInfo = stripTrailingProposalNo(String(infoTitle || ""), prop);
  const fromStored = stripTrailingProposalNo(String(storedTitle || ""), prop);
  if (
    fromInfo &&
    fromStored &&
    (fromStored === fromInfo || fromStored.startsWith(`${fromInfo} `))
  ) {
    return fromInfo;
  }
  return fromStored || fromInfo;
}
