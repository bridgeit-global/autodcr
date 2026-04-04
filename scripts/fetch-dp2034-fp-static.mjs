/**
 * One-off / periodic: pull TPS names + distinct FP_NO from MCGM MapServer/13
 * (same as dpremarks.mcgm.gov.in) and merge into app/utils/villageToCtsMapping.json
 * under the same shape as CS/CTS: ward → label → string[] (GIS keys are TPS_NAME, e.g. "TPS MAHIM No. II").
 *
 *   npm run generate-dp2034-fp
 *
 * Requires network. Re-run when DP2034 layer data changes.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WARDS = [
  "G/N Ward",
  "G/S Ward",
  "H/E Ward",
  "H/W Ward",
  "K/E Ward",
  "K/W Ward",
  "N Ward",
  "P/N Ward",
  "R/C Ward",
];

const LAYER_QUERY =
  "https://agsmaps.mcgm.gov.in/server/rest/services/Development_Plan_2034/MapServer/13/query";

function toApiWard(display) {
  return display.replace(/\s+Ward$/i, "").trim();
}

function escSql(s) {
  return String(s).replace(/'/g, "''");
}

function sortFpLike(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

async function runQuery(where, outField) {
  const params = new URLSearchParams({
    f: "json",
    where,
    outFields: outField,
    returnGeometry: "false",
    returnDistinctValues: "true",
  });
  const url = `${LAYER_QUERY}?${params.toString()}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (DP2034 static export)" } });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (json.error) {
    throw new Error(json.error.message || JSON.stringify(json.error));
  }
  const raw =
    json.features?.map((f) => f.attributes?.[outField]).filter((v) => v != null && String(v) !== "") ?? [];
  return [...new Set(raw.map(String))].sort(sortFpLike);
}

async function main() {
  /** @type {Record<string, Record<string, string[]>>} */
  const out = {};

  for (const ward of WARDS) {
    const api = escSql(toApiWard(ward));
    console.log("Ward:", ward);
    const tpsWhere = `TYPE='TPS' AND WARD='${api}'`;
    const tpsNames = await runQuery(tpsWhere, "TPS_NAME");
    out[ward] = {};
    for (const tps of tpsNames) {
      const fpWhere = `TPS_NAME='${escSql(tps)}' AND WARD='${api}'`;
      const fps = await runQuery(fpWhere, "FP_NO");
      out[ward][tps] = fps;
      console.log("  ", tps, "->", fps.length, "FP");
    }
  }

  const mappingPath = path.join(__dirname, "../app/utils/villageToCtsMapping.json");
  const raw = fs.readFileSync(mappingPath, "utf8");
  /** @type {Record<string, Record<string, string[]>>} */
  const mapping = JSON.parse(raw);

  for (const ward of WARDS) {
    const block = mapping[ward];
    if (!block || typeof block !== "object") {
      console.warn("Skip merge: ward missing in villageToCtsMapping.json:", ward);
      continue;
    }
    for (const [tps, fps] of Object.entries(out[ward] ?? {})) {
      block[tps] = fps;
    }
  }

  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2), "utf8");
  console.log("Merged FP/TPS into", mappingPath, "bytes:", fs.statSync(mappingPath).size);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
