/**
 * Wards where Save Plot offers both CS or CTS and F.P.No (DP Remarks / DP2034 FP search).
 * Ward labels must match `wardOptionsMap` values (e.g. "G/N Ward").
 *
 * MapServer/13 uses short codes: `wardDisplayToDp2034Api` strips the " Ward" suffix
 * (e.g. "G/N Ward" → "G/N") for `TYPE='TPS' AND WARD=…` and FP_NO queries —
 * same as https://dpremarks.mcgm.gov.in/dp2034/ (Widget.js).
 *
 * Wards are included only if the live layer returns TPS features (verified against MapServer).
 * "B Ward" is omitted: WARD='B' has no TPS rows in layer 13.
 */
export const DP2034_FP_WARD_LABELS = [
  "G/N Ward",
  "G/S Ward",
  "H/E Ward",
  "H/W Ward",
  "K/E Ward",
  "K/W Ward",
  "N Ward",
  "P/N Ward",
  "R/C Ward",
] as const;

export const WARDS_WITH_FP_OPTION = new Set<string>(DP2034_FP_WARD_LABELS);

/** GIS MapServer/13 `TPS_NAME` values merged under FP wards in `villageToCtsMapping.json`. */
export function isDp2034GisTpsMappingKey(name: string): boolean {
  return name.startsWith("TPS ");
}
