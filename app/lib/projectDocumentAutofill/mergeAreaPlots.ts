import type { AreaExtractRow, AreaPlotRow, ProjectLibraryExtraction } from "./types";
import {
  hasLocationData,
  isLeafRow,
  leaseAreaOf,
  parseExtractsJson,
  pickString,
  uid,
} from "./utils";

const ZERO = "0";

function toExtractRow(raw: ReturnType<typeof parseExtractsJson>[number]): AreaExtractRow {
  const base = {
    prcArea: pickString(raw.prcArea) || ZERO,
    ulcArea: pickString(raw.ulcArea) || ZERO,
    bFormArea: pickString(raw.bFormArea) || ZERO,
    conveyanceArea: pickString(raw.conveyanceArea) || ZERO,
    attorneyArea: pickString(raw.attorneyArea) || ZERO,
    dilrMapArea: pickString(raw.dilrMapArea) || ZERO,
  };
  return {
    id: uid(),
    extractNo: pickString(raw.extractNo),
    ...base,
    leaseArea: leaseAreaOf(base),
  };
}

function plotFromPrExtraction(
  extraction: ProjectLibraryExtraction,
  plotNumber: number,
  leafOnly: boolean
): AreaPlotRow | null {
  const { extracted } = extraction;
  const rawRows = parseExtractsJson(extracted.extractsJson);
  const filtered = rawRows.filter((row) => (leafOnly ? isLeafRow(row) : true));

  if (!filtered.length && !pickString(extracted.ownerName, extracted.plotName)) {
    return null;
  }

  const extracts =
    filtered.length > 0
      ? filtered.map(toExtractRow)
      : [
          {
            id: uid(),
            extractNo: pickString(extracted.proposedCtsNumber?.split(/[,;/]+/)[0]),
            prcArea: pickString(extracted.grossPlotArea) || ZERO,
            ulcArea: ZERO,
            bFormArea: ZERO,
            conveyanceArea: ZERO,
            attorneyArea: ZERO,
            dilrMapArea: ZERO,
            leaseArea: pickString(extracted.grossPlotArea) || ZERO,
          },
        ];

  const prcTotal = extracts.reduce((sum, row) => sum + (Number(row.prcArea) || 0), 0);

  return {
    id: uid(),
    plotNumber: String(plotNumber),
    plotName: pickString(extracted.plotName, extracted.villageName),
    ownerName: pickString(extracted.ownerName),
    type: hasLocationData(extracted) ? "PRC" : "",
    extractCount: String(extracts.length),
    area: prcTotal > 0 ? prcTotal.toString() : "",
    extracts,
  };
}

export function mergeAreaPlots(
  extractions: ProjectLibraryExtraction[],
  options?: { leafOnly?: boolean }
): AreaPlotRow[] {
  const leafOnly = options?.leafOnly ?? true;
  const prCards = extractions.filter((e) => e.documentType === "pr-card");
  const plots: AreaPlotRow[] = [];

  prCards.forEach((extraction, index) => {
    const plot = plotFromPrExtraction(extraction, index + 1, leafOnly);
    if (plot) plots.push(plot);
  });

  return plots;
}

export function computeAreaTotals(plots: AreaPlotRow[]) {
  const allPlotsTotal = {
    prcArea: 0,
    ulcArea: 0,
    bFormArea: 0,
    conveyanceArea: 0,
    attorneyArea: 0,
    dilrMapArea: 0,
    leaseArea: 0,
  };

  for (const plot of plots) {
    for (const extract of plot.extracts) {
      allPlotsTotal.prcArea += Number(extract.prcArea) || 0;
      allPlotsTotal.ulcArea += Number(extract.ulcArea) || 0;
      allPlotsTotal.bFormArea += Number(extract.bFormArea) || 0;
      allPlotsTotal.conveyanceArea += Number(extract.conveyanceArea) || 0;
      allPlotsTotal.attorneyArea += Number(extract.attorneyArea) || 0;
      allPlotsTotal.dilrMapArea += Number(extract.dilrMapArea) || 0;
      allPlotsTotal.leaseArea += Number(extract.leaseArea) || 0;
    }
  }

  return {
    allPlotsTotal,
    totalLeaseArea: allPlotsTotal.leaseArea,
  };
}
