/**
 * Smoke: mergeSavePlot / mergeAreaPlots reconcile after delete/replace.
 *   node --import tsx scripts/verify-pr-library-reconcile.mjs
 */
import { mergeSavePlot } from "../app/lib/projectDocumentAutofill/mergeSavePlot.ts";
import {
  mergeAreaPlots,
  computeAreaTotals,
} from "../app/lib/projectDocumentAutofill/mergeAreaPlots.ts";

function pr(partial) {
  return {
    slot: partial.slot ?? "pr-extra",
    documentType: "pr-card",
    label: partial.label ?? "PR",
    valid: true,
    missingFields: [],
    fixedIndex: partial.fixedIndex,
    extracted: partial.extracted,
  };
}

const primary = pr({
  slot: "pr-primary",
  fixedIndex: 0,
  label: "Primary",
  extracted: {
    downloadDate: "12/02/2025",
    proposedCtsNumber: "177-32",
    extractsJson: JSON.stringify([
      {
        extractNo: "177-32",
        prcArea: "10",
        ulcArea: "0",
        bFormArea: "0",
        conveyanceArea: "0",
        attorneyArea: "0",
        dilrMapArea: "0",
        isLeaf: true,
      },
    ]),
    ownerName: "A",
    plotName: "KURLA",
  },
});
const extra = pr({
  slot: "pr-extra",
  label: "Extra",
  extracted: {
    downloadDate: "01/01/2020",
    proposedCtsNumber: "177-30",
    extractsJson: JSON.stringify([
      {
        extractNo: "177-30",
        prcArea: "5",
        ulcArea: "0",
        bFormArea: "0",
        conveyanceArea: "0",
        attorneyArea: "0",
        dilrMapArea: "0",
        isLeaf: true,
      },
    ]),
    ownerName: "B",
    plotName: "KURLA",
  },
});

const both = mergeSavePlot([primary, extra]);
const plotsBoth = mergeAreaPlots([primary, extra]);
if (both.prcDownloadDate !== "12/02/2025") throw new Error("primary date");
if (
  !both.proposedCtsNumber.includes("177-32") ||
  !both.proposedCtsNumber.includes("177-30")
) {
  throw new Error(`cts union: ${JSON.stringify(both.proposedCtsNumber)}`);
}
if (plotsBoth.length !== 2) throw new Error("plot count");

const afterDeleteExtra = mergeSavePlot([primary]);
const plotsAfterExtra = mergeAreaPlots([primary]);
if (afterDeleteExtra.proposedCtsNumber.includes("177-30")) {
  throw new Error("deleted extra CTS stuck");
}
if (plotsAfterExtra.length !== 1) throw new Error("plot after extra delete");

const afterDeletePrimary = mergeSavePlot([extra]);
if (afterDeletePrimary.prcDownloadDate !== "01/01/2020") {
  throw new Error("date should fall back to remaining PR when primary missing");
}
if (!afterDeletePrimary.proposedCtsNumber.includes("177-30")) {
  throw new Error("extra cts remain");
}

const newPrimary = pr({
  slot: "pr-primary",
  fixedIndex: 0,
  extracted: {
    downloadDate: "15/03/2026",
    proposedCtsNumber: "177-99",
    extractsJson: "[]",
    ownerName: "C",
  },
});
const replaced = mergeSavePlot([newPrimary, extra]);
if (replaced.prcDownloadDate !== "15/03/2026") {
  throw new Error("new primary date");
}

const empty = mergeSavePlot([]);
const emptyPlots = mergeAreaPlots([]);
const emptyTotals = computeAreaTotals(emptyPlots);
if (empty.proposedCtsNumber.length !== 0) throw new Error("empty cts");
if (empty.prcDownloadDate !== "") throw new Error("empty date");
if (emptyPlots.length !== 0 || emptyTotals.totalLeaseArea !== 0) {
  throw new Error("empty area");
}

console.log("SMOKE OK");
