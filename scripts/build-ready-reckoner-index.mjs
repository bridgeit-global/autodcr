/**
 * Builds readyReckonerIndex.json from dump.json.
 * Run: npm run build:reckoner-index
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildReckonerIndexFromDump } from "./reckonerIndexBuilder.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const dumpPath = join(ROOT, "dump.json");
const outPath = join(ROOT, "app/data/readyReckonerIndex.json");

const rows = JSON.parse(readFileSync(dumpPath, "utf8"));
const { index: output, stats } = buildReckonerIndexFromDump(rows);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(output));

console.log(`Wrote ${outPath}`);
console.log(
  `Villages: ${stats.villageCount}, survey keys: ${stats.surveyKeyCount}, expanded rows: ${stats.expanded}`
);
if (stats.skippedVillages) {
  console.warn(`Skipped rows with unmapped villages: ${stats.skippedVillages}`);
}

const bandraA = output["BANDRA-A"]?.["268A"];
if (bandraA) {
  console.log("BANDRA-A / 268A residential:", bandraA.residential);
} else {
  console.error("Missing sanity check: BANDRA-A / 268A");
  process.exit(1);
}
