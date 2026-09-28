import { readdir, readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function isSafeHtmlBasename(file: string): boolean {
  if (!file || file.includes("..") || file.includes("/") || file.includes("\\")) {
    return false;
  }
  return file.toLowerCase().endsWith(".html");
}

async function findHtmlUnderBase(base: string, basename: string): Promise<string | null> {
  const direct = path.resolve(base, basename);
  const directRel = path.relative(base, direct);
  if (!directRel.startsWith("..") && !path.isAbsolute(directRel)) {
    try {
      return await readFile(direct, "utf8");
    } catch {
      /* try nested folders */
    }
  }

  async function walk(dir: string, depth: number): Promise<string | null> {
    if (depth > 3) return null;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const ent of entries) {
      if (ent.name.startsWith(".")) continue;
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

/**
 * Raw application template HTML for Letter fields token scanning.
 * Reads repo `html/<file>` (catalog flat names; also searches one–three levels deep).
 */
export async function GET(request: NextRequest) {
  const file = request.nextUrl.searchParams.get("file")?.trim() || "";
  if (!isSafeHtmlBasename(file)) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }

  const base = path.resolve(process.cwd(), "html");
  try {
    const text = await findHtmlUnderBase(base, file);
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
  } catch {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
}
