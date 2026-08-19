import type { AcApWebworkerFiles } from "@mlightcad/cad-simple-viewer";

export const CAD_WORKERS_BASE = "/cad-workers";

export const WEBWORKER_FILE_URLS: AcApWebworkerFiles = {
  mtextRender: `${CAD_WORKERS_BASE}/mtext-renderer-worker.js`,
  dwgParser: `${CAD_WORKERS_BASE}/libredwg-parser-worker.js`,
};
