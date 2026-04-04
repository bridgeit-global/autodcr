// Village to Survey Numbers mapping (CS/CTS + F.P.No GIS data in one file)
// Uses static local data instead of external API calls.
// F.P. TPS_NAME → FP_NO rows are merged into villageToCtsMapping.json by scripts/fetch-dp2034-fp-static.mjs

import ctsMappingData from './villageToCtsMapping.json';
import { getFpTpsSchemaOptionsForWard, resolveFpTpsSchemaToMappingVillage } from './fpTpsSchemaMapping';
import { isDp2034GisTpsMappingKey } from './dp2034FpWards';

// Type definition for the mapping structure
type CtsMapping = Record<string, Record<string, string[]>>;

const ctsMapping = ctsMappingData as unknown as CtsMapping;

// Helper function to get all CTS numbers (survey numbers) for a village and ward
// Returns data from local static mapping - no API calls needed
export function getSurveyNumbersForVillage(
  village: string,
  ward: string
): string[] {
  if (!village || !ward) return [];

  // Look up CTS numbers from the static mapping
  const wardData = ctsMapping[ward];
  if (!wardData) {
    console.warn(`No CTS data found for ward: ${ward}`);
    return [];
  }

  const ctsNumbers = wardData[village];
  if (!ctsNumbers || ctsNumbers.length === 0) {
    console.warn(`No CTS numbers found for village: ${village} in ward: ${ward}`);
    return [];
  }

  // Return a copy of the array (already sorted in ascending order)
  return [...ctsNumbers];
}

// Synchronous version (now the main version since we use local data)
export function getSurveyNumbersForVillageSync(village: string, ward: string): string[] {
  return getSurveyNumbersForVillage(village, ward);
}

/**
 * Survey / F.P. numbers for Save Plot: CS/CTS use village/division names as mapping keys;
 * F.P.No may use GIS TPS labels (e.g. "TPS MAHIM No. II") resolved via fpTpsSchemaMapping.
 */
export function getSurveyNumbersForPlotFlowSync(
  ward: string,
  villageNameField: string,
  plotBelongsTo: string
): string[] {
  if (!villageNameField || !ward) return [];
  if (plotBelongsTo === "F.P.No") {
    const wardData = ctsMapping[ward];
    if (wardData) {
      const direct = wardData[villageNameField];
      if (Array.isArray(direct) && direct.length > 0) {
        return [...direct];
      }
    }
    const mapped = resolveFpTpsSchemaToMappingVillage(ward, villageNameField);
    const key = mapped ?? villageNameField;
    return getSurveyNumbersForVillage(key, ward);
  }
  return getSurveyNumbersForVillage(villageNameField, ward);
}

/**
 * TPS schema dropdown options for F.P.No: GIS labels when defined for the ward, else DP2034 mapping keys.
 */
export function getTpsSchemaOptionsForWard(ward: string): string[] {
  if (!ward) return [];
  const fpSpecific = getFpTpsSchemaOptionsForWard(ward);
  if (fpSpecific) return fpSpecific;
  const wardData = ctsMapping[ward];
  if (!wardData) return [];
  const tpsKeys = Object.keys(wardData).filter(isDp2034GisTpsMappingKey);
  if (tpsKeys.length > 0) {
    return tpsKeys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
  }
  return Object.keys(wardData).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
