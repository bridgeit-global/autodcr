/**
 * Optional GIS TPS label → legacy village key in villageToCtsMapping.json (CS/CTS blocks).
 * Prefer direct keys: merged MapServer/13 data uses TPS_NAME as the key (e.g. "TPS MAHIM No. II") with FP lists.
 * This table is only used when the selected label has no direct entry under the ward.
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
