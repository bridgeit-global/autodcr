/**
 * Upload dump.json ready-reckoner data to Supabase.
 *
 *   npm run seed:reckoner
 *   npm run seed:reckoner -- --truncate
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 * (or the environment). Apply migration 20260820120000_create_ready_reckoner_rates.sql first.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildReckonerIndexFromDump } from "./reckonerIndexBuilder.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BATCH_SIZE = 500;

function loadEnvLocal() {
  const raw = readFileSync(join(ROOT, ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const value = match[2].replace(/^["']|["']$/g, "");
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
}

try {
  loadEnvLocal();
} catch {
  // .env.local optional when vars are already exported
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const truncate = process.argv.includes("--truncate");

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const dumpPath = join(ROOT, "dump.json");
const rows = JSON.parse(readFileSync(dumpPath, "utf8"));
const { flatRows, stats } = buildReckonerIndexFromDump(rows);

console.log(
  `Prepared ${flatRows.length} rate rows from dump.json (${stats.villageCount} villages)`
);

if (truncate) {
  console.log("Truncating ready_reckoner_rates…");
  const { error: deleteError } = await supabase
    .from("ready_reckoner_rates")
    .delete()
    .neq("english_village", "");
  if (deleteError) {
    console.error("Truncate failed:", deleteError.message);
    process.exit(1);
  }
}

let uploaded = 0;
for (let i = 0; i < flatRows.length; i += BATCH_SIZE) {
  const batch = flatRows.slice(i, i + BATCH_SIZE);
  const { error } = await supabase.from("ready_reckoner_rates").upsert(batch, {
    onConflict: "english_village,survey_no",
  });
  if (error) {
    console.error(`Upsert failed at batch ${i / BATCH_SIZE + 1}:`, error.message);
    process.exit(1);
  }
  uploaded += batch.length;
  process.stdout.write(`\rUploaded ${uploaded}/${flatRows.length}`);
}

console.log("\nDone.");

const { data: check } = await supabase
  .from("ready_reckoner_rates")
  .select("residential")
  .eq("english_village", "BANDRA-A")
  .eq("survey_no", "268A")
  .maybeSingle();

if (check?.residential === 216630) {
  console.log("Sanity check passed: BANDRA-A / 268A residential = 216630");
} else {
  console.warn("Sanity check: BANDRA-A / 268A not found or unexpected rate", check);
}
