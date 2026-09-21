/**
 * Sync letter HTML into the `Application_Templates` Storage bucket.
 *
 * Put files in `html/` using the exact catalog `html` filename, then:
 *
 *   pnpm sync:templates --list
 *   pnpm sync:templates --all
 *   pnpm sync:templates --dir ./html
 *   pnpm sync:templates fact-sheet.html work-start-notice.html
 *   pnpm sync:templates /path/to/fact-sheet.html
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { createClient } from "@supabase/supabase-js";
import { readdir, readFile, stat } from "node:fs/promises";
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
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function printUsage() {
  console.log(`Upload HTML templates to Storage bucket "${BUCKET}".

  pnpm sync:templates --list
  pnpm sync:templates --all
  pnpm sync:templates --dir ./html
  pnpm sync:templates fact-sheet.html work-start-notice.html
  pnpm sync:templates /absolute/path/to/fact-sheet.html

File names must match the catalog html column (e.g. fact-sheet.html).
`);
}

function storageObjectName(filePath) {
  const abs = path.resolve(filePath);
  const rel = path.relative(HTML_DIR, abs);
  if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) {
    return rel.split(path.sep).join("/");
  }
  return path.basename(abs);
}

async function collectFilesInDir(dir) {
  const names = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      names.push(...(await collectFilesInDir(full)));
      continue;
    }
    if (entry.isFile() && /\.(html|css)$/i.test(entry.name)) {
      names.push(full);
    }
  }
  return names;
}

async function uploadOne(filePath) {
  const objectName = storageObjectName(filePath);
  const body = await readFile(filePath, "utf8");
  const contentType = objectName.toLowerCase().endsWith(".css")
    ? "text/css; charset=utf-8"
    : "text/html; charset=utf-8";
  const { error } = await supabase.storage.from(BUCKET).upload(objectName, body, {
    contentType,
    upsert: true,
  });
  if (error) {
    console.error(`FAILED ${objectName}: ${error.message}`);
    return false;
  }
  console.log(`uploaded ${objectName} (${body.length} bytes)`);
  return true;
}

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  printUsage();
  process.exit(0);
}

if (args.includes("--list") || args.length === 0) {
  if (args.length === 0) printUsage();
  const { data, error } = await supabase.storage.from(BUCKET).list("", { limit: 200 });
  if (error) {
    console.error("list failed:", error.message);
    process.exit(1);
  }
  console.log(`\n${BUCKET}:`);
  for (const entry of data ?? []) {
    console.log(`${entry.name}\t${entry.metadata?.size ?? "-"}\t${entry.updated_at ?? "-"}`);
  }
  process.exit(0);
}

if (args[0] === "--diff") {
  for (const name of args.slice(1)) {
    const localPath = path.isAbsolute(name) ? name : path.join(HTML_DIR, name);
    const local = await readFile(localPath, "utf8");
    const objectName = storageObjectName(localPath);
    const { data, error } = await supabase.storage.from(BUCKET).download(objectName);
    if (error) {
      console.error(`${objectName}: download failed - ${error.message}`);
      continue;
    }
    const remote = await data.text();
    if (remote === local) {
      console.log(`${objectName}: identical`);
      continue;
    }
    const localLines = local.split("\n");
    const remoteLines = remote.split("\n");
    const changed = [];
    for (let i = 0; i < Math.max(localLines.length, remoteLines.length); i++) {
      if (localLines[i] !== remoteLines[i]) changed.push(i + 1);
    }
    console.log(
      `${objectName}: differs (${remoteLines.length} remote vs ${localLines.length} local lines), first diff at line ${changed[0]}, last at ${changed[changed.length - 1]}`
    );
  }
  process.exit(0);
}

const files = [];
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--all") {
    files.push(...(await collectFilesInDir(HTML_DIR)));
    continue;
  }
  if (arg === "--dir") {
    const dir = args[++i];
    if (!dir) {
      console.error("--dir needs a folder path");
      process.exit(1);
    }
    const info = await stat(dir).catch(() => null);
    if (!info?.isDirectory()) {
      console.error(`Not a folder: ${dir}`);
      process.exit(1);
    }
    files.push(...(await collectFilesInDir(path.resolve(dir))));
    continue;
  }
  const resolved = path.isAbsolute(arg) ? arg : path.join(HTML_DIR, arg);
  files.push(resolved);
}

if (!files.length) {
  printUsage();
  process.exit(1);
}

const unique = [...new Set(files)];
let failed = false;
for (const filePath of unique) {
  const ok = await uploadOne(filePath).catch((err) => {
    console.error(`FAILED ${filePath}: ${err.message}`);
    return false;
  });
  if (!ok) failed = true;
}
process.exit(failed ? 1 : 0);
