import type {
  Authority,
  AuthorityId,
  AuthorityWithDocuments,
  RegulationLookup,
  RegulationMeta,
} from "./types";

export const AUTHORITIES: Authority[] = [
  { id: "cidco", label: "CIDCO", description: "Navi Mumbai / CIDCO area" },
  { id: "midc", label: "MIDC", description: "MIDC industrial areas" },
  { id: "sra", label: "SRA", description: "Slum Rehabilitation Authority" },
  {
    id: "mcgm",
    label: "MCGM / DCPR",
    description: "Mumbai Municipal Corporation / DCPR 2034",
  },
  { id: "udcpr", label: "UDCPR", description: "Unified DCPR (Maharashtra)" },
  {
    id: "stamp_duty",
    label: "Stamp Duty",
    description: "Mumbai stamp duty / ready reckoner",
  },
];

/**
 * Keys are exact basenames under the regulations docs dir.
 * Note: one CIDCO file has a trailing space before .pdf.
 */
export const REGULATION_CATALOG: Record<string, RegulationMeta> = {
  "cidco-general-development-regulations .pdf": {
    authority: "cidco",
    docType: "regulation",
    areas: ["cidco", "navi_mumbai"],
    title: "CIDCO General Development Regulations",
  },
  "cidco-general-development-circular.pdf": {
    authority: "cidco",
    docType: "circular",
    areas: ["cidco", "navi_mumbai"],
    title: "CIDCO General Development Circular",
  },
  "midc-revised-developement-control-regualation-2009.pdf": {
    authority: "midc",
    docType: "regulation",
    areas: ["midc"],
    title: "MIDC Revised Development Control Regulation 2009",
  },
  "mcgm-circular.pdf": {
    authority: "mcgm",
    docType: "circular",
    areas: ["mumbai", "mcgm"],
    title: "MCGM Circular",
  },
  "DCPR 2034 PEATA.pdf": {
    authority: "mcgm",
    docType: "regulation",
    areas: ["mumbai", "mcgm"],
    title: "DCPR 2034 (PEATA)",
  },
  "PEATA DCPR-2034 Book.pdf": {
    authority: "mcgm",
    docType: "regulation",
    areas: ["mumbai", "mcgm"],
    title: "PEATA DCPR-2034 Book",
  },
  "PEATA Circulars Notifications till March 2022.pdf": {
    authority: "mcgm",
    docType: "circular",
    areas: ["mumbai", "mcgm"],
    title: "PEATA Circulars & Notifications (till March 2022)",
  },
  "SRA MANUAL.pdf": {
    authority: "sra",
    docType: "manual",
    areas: ["sra", "mumbai"],
    title: "SRA Manual",
  },
  "UDCPR.pdf": {
    authority: "udcpr",
    docType: "regulation",
    areas: ["maharashtra", "udcpr"],
    title: "UDCPR",
  },
  "mumbai-stamp-duty-ready-reckoner-2025-26-sampat-doshi.pdf": {
    authority: "stamp_duty",
    docType: "ready_reckoner",
    areas: ["mumbai"],
    title: "Mumbai Stamp Duty Ready Reckoner 2025-26",
  },
};

export function lookupRegulation(sourceName: string): RegulationLookup {
  const exact = REGULATION_CATALOG[sourceName];
  if (exact) return { ...exact, source: sourceName };

  const lower = sourceName.toLowerCase();
  for (const [name, meta] of Object.entries(REGULATION_CATALOG)) {
    if (name.toLowerCase() === lower) {
      return { ...meta, source: name };
    }
  }

  if (/cidco/i.test(sourceName)) {
    return {
      authority: "cidco",
      docType: /circular/i.test(sourceName) ? "circular" : "regulation",
      areas: ["cidco"],
      title: sourceName,
      source: sourceName,
    };
  }
  if (/midc/i.test(sourceName)) {
    return {
      authority: "midc",
      docType: "regulation",
      areas: ["midc"],
      title: sourceName,
      source: sourceName,
    };
  }
  if (/sra/i.test(sourceName)) {
    return {
      authority: "sra",
      docType: "manual",
      areas: ["sra"],
      title: sourceName,
      source: sourceName,
    };
  }
  if (/udcpr/i.test(sourceName)) {
    return {
      authority: "udcpr",
      docType: "regulation",
      areas: ["udcpr"],
      title: sourceName,
      source: sourceName,
    };
  }
  if (/stamp|ready.?reckoner/i.test(sourceName)) {
    return {
      authority: "stamp_duty",
      docType: "ready_reckoner",
      areas: ["mumbai"],
      title: sourceName,
      source: sourceName,
    };
  }
  if (/dcpr|peata|mcgm/i.test(sourceName)) {
    return {
      authority: "mcgm",
      docType: /circular/i.test(sourceName) ? "circular" : "regulation",
      areas: ["mumbai", "mcgm"],
      title: sourceName,
      source: sourceName,
    };
  }

  return {
    authority: "unknown",
    docType: "regulation",
    areas: [],
    title: sourceName,
    source: sourceName,
  };
}

export function listAuthorities(): AuthorityWithDocuments[] {
  return AUTHORITIES.map((a) => ({
    ...a,
    documents: Object.entries(REGULATION_CATALOG)
      .filter(([, m]) => m.authority === a.id)
      .map(([filename, m]) => ({
        filename,
        title: m.title,
        docType: m.docType,
      })),
  }));
}

export function normalizeAuthorities(input: unknown): string[] {
  if (!input) return [];
  const ids = new Set<string>(AUTHORITIES.map((a) => a.id));
  const raw = Array.isArray(input)
    ? input.map((s) => String(s))
    : String(input)
        .split(/[,|\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
  return [
    ...new Set(
      raw
        .map((s) => s.toLowerCase().replace(/[\s/-]+/g, "_"))
        .map((s) => {
          if (s === "dcpr" || s === "mumbai" || s === "bmc") return "mcgm";
          if (s === "navi_mumbai") return "cidco";
          return s;
        })
        .filter((s) => ids.has(s))
    ),
  ];
}

export function isAuthorityId(id: string): id is Exclude<AuthorityId, "unknown"> {
  return AUTHORITIES.some((a) => a.id === id);
}
