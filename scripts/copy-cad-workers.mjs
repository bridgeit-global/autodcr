import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "public", "cad-workers");

mkdirSync(dest, { recursive: true });

const files = [
  [
    "node_modules/@mlightcad/cad-simple-viewer/dist/mtext-renderer-worker.js",
    "mtext-renderer-worker.js",
  ],
  [
    "node_modules/@mlightcad/libredwg-converter/dist/libredwg-parser-worker.js",
    "libredwg-parser-worker.js",
  ],
  [
    "node_modules/@mlightcad/libredwg-converter/dist/libredwg-web.wasm",
    "libredwg-web.wasm",
  ],
];

let copied = 0;
for (const [srcRel, name] of files) {
  const src = join(root, srcRel);
  if (!existsSync(src)) {
    console.warn(`[copy-cad-workers] missing ${srcRel}`);
    continue;
  }
  copyFileSync(src, join(dest, name));
  copied += 1;
}

if (copied === 0) {
  console.warn("[copy-cad-workers] no worker files copied");
} else {
  console.log(`[copy-cad-workers] copied ${copied} file(s) to public/cad-workers`);
}
