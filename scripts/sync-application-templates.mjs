/**
 * Sync `html/` letter templates into the `Application_Templates` Storage bucket,
 * which `/api/application-preview-html` reads before falling back to the repo copy.
 *
 *   node scripts/sync-application-templates.mjs --list
 *   node scripts/sync-application-templates.mjs --diff <file.html> [...]
 *   node scripts/sync-application-templates.mjs <file.html> [...]
 */
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const BUCKET = "Application_Templates";
const HTML_DIR = path.resolve(import.meta.dirname, "..", "html");

async function loadEnvLocal() {
  const raw = await readFile(
    path.resolve(import.meta.dirname, "..", ".env.local"),
    "utf8"
  ).catch(() => "");
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const value = match[2].replace(/^["']|["']$/g, "");
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
}

await loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const args = process.argv.slice(2);

if (args.includes("--list") || args.length === 0) {
  const { data, error } = await supabase.storage.from(BUCKET).list("", { limit: 200 });
  if (error) {
    console.error("list failed:", error.message);
    process.exit(1);
  }
  for (const entry of data) {
    console.log(`${entry.name}\t${entry.metadata?.size ?? "-"}\t${entry.updated_at ?? "-"}`);
  }
  process.exit(0);
}

if (args[0] === "--diff") {
  for (const name of args.slice(1)) {
    const local = await readFile(path.join(HTML_DIR, name), "utf8");
    const { data, error } = await supabase.storage.from(BUCKET).download(name);
    if (error) {
      console.error(`${name}: download failed - ${error.message}`);
      continue;
    }
    const remote = await data.text();
    if (remote === local) {
      console.log(`${name}: identical`);
      continue;
    }
    const localLines = local.split("\n");
    const remoteLines = remote.split("\n");
    const changed = [];
    for (let i = 0; i < Math.max(localLines.length, remoteLines.length); i++) {
      if (localLines[i] !== remoteLines[i]) changed.push(i + 1);
    }
    console.log(
      `${name}: differs (${remoteLines.length} remote vs ${localLines.length} local lines), first diff at line ${changed[0]}, last at ${changed[changed.length - 1]}`
    );
  }
  process.exit(0);
}

let failed = false;
for (const name of args) {
  const body = await readFile(path.join(HTML_DIR, name), "utf8");
  const { error } = await supabase.storage.from(BUCKET).upload(name, body, {
    contentType: "text/html; charset=utf-8",
    upsert: true,
  });
  if (error) {
    failed = true;
    console.error(`FAILED ${name}: ${error.message}`);
  } else {
    console.log(`uploaded ${name} (${body.length} bytes)`);
  }
}
process.exit(failed ? 1 : 0);
