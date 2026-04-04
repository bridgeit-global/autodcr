/**
 * DP Remarks / DP2034 ArcGIS MapServer (same source as https://dpremarks.mcgm.gov.in/dp2034/ — Widget.js).
 * Layer 13: TPS polygons (TYPE='TPS', WARD, TPS_NAME) and FP features (FP_NO, TPS_NAME, WARD).
 */

export const DP2034_MAPSERVER_LAYER_13 =
  "https://agsmaps.mcgm.gov.in/server/rest/services/Development_Plan_2034/MapServer/13/query";

/** Portal uses short ward codes (e.g. "G/N"); our UI uses "G/N Ward". */
export function wardDisplayToDp2034Api(ward: string): string {
  return ward.replace(/\s+Ward$/i, "").trim();
}

export function escapeArcSqlString(value: string): string {
  return value.replace(/'/g, "''");
}
