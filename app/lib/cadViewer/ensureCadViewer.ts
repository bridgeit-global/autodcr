import {
  AcApDocManager,
  AcApOpenViewMode,
  AcEdOpenMode,
  acedApplyUiTheme,
} from "@mlightcad/cad-simple-viewer";
import { registerLibreDwgConverter } from "@/app/lib/cadViewer/bootCadViewer";
import { WEBWORKER_FILE_URLS } from "@/app/lib/cadViewer/workerConfig";

let bootPromise: Promise<AcApDocManager> | null = null;

export async function ensureCadViewer(container: HTMLElement): Promise<AcApDocManager> {
  if (bootPromise) return bootPromise;

  bootPromise = (async () => {
    const dwgParserUrl = String(WEBWORKER_FILE_URLS.dwgParser);
    registerLibreDwgConverter(dwgParserUrl);

    const workersReachable = await AcApDocManager.checkWebworkerReadiness(WEBWORKER_FILE_URLS);
    if (!workersReachable) {
      throw new Error(
        "CAD worker scripts are missing. Run npm run copy-cad-workers and reload."
      );
    }

    acedApplyUiTheme("light", container);

    AcApDocManager.createInstance({
      container,
      busyIndicatorHost: container,
      autoResize: true,
      baseUrl: "https://cdn.jsdelivr.net/gh/mlightcad/cad-data@main/",
      webworkerFileUrls: WEBWORKER_FILE_URLS,
      checkWorkersOnInit: true,
      useMainThreadDraw: false,
    });

    return AcApDocManager.instance;
  })();

  try {
    return await bootPromise;
  } catch (error) {
    bootPromise = null;
    throw error;
  }
}

export async function openCadDocument(
  manager: AcApDocManager,
  name: string,
  content: ArrayBuffer
): Promise<boolean> {
  if (!(await manager.areWorkersReady())) {
    throw new Error("CAD worker scripts are not reachable.");
  }

  const success = await manager.openDocument(name, content, {
    minimumChunkSize: 1000,
    mode: AcEdOpenMode.Review,
    drawNoPlotLayers: false,
    progressiveRendering: true,
    openViewMode: AcApOpenViewMode.Extents,
  });

  if (success) {
    try {
      await manager.executeCommandString("zoom\ne");
    } catch {
      // Zoom extents is best-effort after a successful open.
    }
  }

  return success;
}
