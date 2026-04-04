/**
 * MCGM GIS "Search → FP" style TPS scheme labels per ward.
 * Labels are shown in the portal; each maps to a village key in villageToCtsMapping.json for that ward.
 * Adjust mappings if official crosswalk differs.
 */
export const FP_TPS_SCHEMA_OPTIONS_BY_WARD: Record<string, readonly string[]> = {
  "G/N Ward": ["TPS MAHIM No. II", "TPS MAHIM No. III", "TPS MAHIM No. IV"],
};

/** GIS TPS label → key under ward in villageToCtsMapping.json */
export const FP_TPS_SCHEMA_TO_MAPPING_VILLAGE: Record<string, Record<string, string>> = {
  "G/N Ward": {
    "TPS MAHIM No. II": "MAHIM",
    "TPS MAHIM No. III": "PARIGHIKARI",
    "TPS MAHIM No. IV": "DHARAVI",
  },
};

export function getFpTpsSchemaOptionsForWard(ward: string): string[] | null {
  const opts = FP_TPS_SCHEMA_OPTIONS_BY_WARD[ward];
  return opts ? [...opts] : null;
}

export function resolveFpTpsSchemaToMappingVillage(ward: string, label: string): string | null {
  const m = FP_TPS_SCHEMA_TO_MAPPING_VILLAGE[ward];
  if (!m || !label) return null;
  return m[label] ?? null;
}
