import { readdir, readFile } from "fs/promises";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const TEMPLATE_BUCKET =
  process.env.SUPABASE_APPLICATION_TEMPLATE_BUCKET?.trim() ||
  process.env.NEXT_PUBLIC_APPLICATION_TEMPLATE_BUCKET?.trim() ||
  "Application_Templates";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  process.env.SUPABASE_URL?.trim() ||
  "";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  process.env.SUPABASE_ANON_KEY?.trim() ||
  "";

/** Relative Storage/repo path under html/; allow folders + spaces, block traversal. */
function isSafeHtmlObjectPath(file: string): boolean {
  if (!file || file.includes("\0") || file.includes("\\")) return false;
  if (file.startsWith("/") || file.includes("..")) return false;
  if (!file.toLowerCase().endsWith(".html")) return false;
  return true;
}

async function readHtmlAtRelativePath(
  base: string,
  objectPath: string
): Promise<string | null> {
  const abs = path.resolve(base, objectPath);
  const rel = path.relative(base, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  try {
    return await readFile(abs, "utf8");
  } catch {
    return null;
  }
}

/** Fallback when catalog still has a bare basename: find first match under html/. */
async function findHtmlByBasename(
  base: string,
  basename: string
): Promise<string | null> {
  async function walk(dir: string, depth: number): Promise<string | null> {
    if (depth > 3) return null;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const ent of entries) {
      if (ent.name.startsWith(".") || ent.name === "htmls") continue;
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        const found = await walk(abs, depth + 1);
        if (found) return found;
        continue;
      }
      if (ent.isFile() && ent.name === basename) {
        try {
          return await readFile(abs, "utf8");
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  return walk(base, 0);
}

async function downloadStorageTemplateHtml(objectPath: string): Promise<string | null> {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase.storage.from(TEMPLATE_BUCKET).download(objectPath);
    if (error || !data) return null;
    return await data.text();
  } catch {
    return null;
  }
}

/**
 * Raw application template HTML for Letter fields token scanning.
 * Repo `html/` first (when bundled), then Supabase Storage — same catalog paths
 * as Application_Templates (folder-relative or flat basenames).
 */
export async function GET(request: NextRequest) {
  const file = request.nextUrl.searchParams.get("file")?.trim() || "";
  if (!isSafeHtmlObjectPath(file)) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }

  const base = path.resolve(
    process.cwd(),
    process.env.APPLICATION_TEMPLATES_LOCAL_DIR?.trim() || "html"
  );

  let text: string | null = null;
  try {
    text = await readHtmlAtRelativePath(base, file);
    if (text == null && !file.includes("/")) {
      text = await findHtmlByBasename(base, file);
    }
  } catch {
    text = null;
  }
  if (text == null) {
    text = await downloadStorageTemplateHtml(file);
  }

  if (text == null) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return new NextResponse(text, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
