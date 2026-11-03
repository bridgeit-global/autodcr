import { loadDraft, saveDraft } from "@/app/utils/draftStorage";
import type { ProjectAutofillResult } from "./types";
import { notifyProjectAutofillApplied } from "./hydration";
import { enrichSavePlotLocation, sanitizeCtsNumbers, sanitizeSacNumbers } from "./utils";

const SAVE_PLOT_DEFAULTS = {
  planningAuthority: "",
  projectProponent: "",
  plotBelongsTo: "",
  region: "",
  zone: "",
  ward: "",
  villageName: "",
  proposedCtsNumber: [] as string[],
  grossPlotArea: "",
  sacNo: [] as string[],
  roadName: "",
  dpZone: "",
  majorUseOfPlot: "",
  plotSubUse: "",
  plotNo: "",
  isInternalRoadPresent: "",
  plotType: "",
  plotEntries: [{ ctsNumber: "", sacNumber: "", verifyPropertyTax: "", prCard: "" }],
  prcDownloadDate: "",
};

const PROJECT_DEFAULTS = {
  proposalAsPer: "DCPR 2034" as const,
  title: "",
  proposalNo: "",
  propertyAddress: "",
  landmark: "",
  earlierBuildingProposalFileNo: "",
  pincode: "",
  fullNameOfApplicant: "",
  addressOfApplicant: "",
  hasPaidLatestPropertyTax: "" as const,
};

const APPLICANT_DEFAULTS = {
  applicantType: "",
  name: "",
  residentialAddress: "",
  contactNumber: "",
  emailAddress: "",
  registrationNumber: "",
  panNo: "",
  licenseIssueDate: "",
};

/** Keys owned by Project Library extraction — full-replace from merge (incl. empty). */
const LIBRARY_REPLACE_SAVE_PLOT_KEYS = [
  "proposedCtsNumber",
  "sacNo",
  "prcDownloadDate",
] as const;

function mergeDefined<T extends Record<string, unknown>>(base: T, patch: Record<string, unknown>): T {
  const next = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && !value.trim()) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    (next as Record<string, unknown>)[key] = value;
  }
  return next;
}

const EMPTY_AREA_TOTALS: ProjectAutofillResult["areaTotals"] = {
  allPlotsTotal: {
    prcArea: 0,
    ulcArea: 0,
    bFormArea: 0,
    conveyanceArea: 0,
    attorneyArea: 0,
    dilrMapArea: 0,
    leaseArea: 0,
  },
  totalLeaseArea: 0,
};

/** Write merged autofill into Create Project draft keys and mark downstream sections dirty. */
export function applyProjectAutofillDrafts(autofill: ProjectAutofillResult): void {
  // Always reconcile Area from the current extraction set (empty clears deleted PR plots).
  saveDraft("draft-area-details-plots", autofill.areaPlots);
  saveDraft(
    "draft-area-details-totals",
    autofill.areaPlots.length > 0 ? autofill.areaTotals : EMPTY_AREA_TOTALS
  );
  saveDraft("dirty-area-details", true);

  const existingSavePlot = loadDraft<Record<string, unknown>>(
    "draft-project-details-save-plot",
    SAVE_PLOT_DEFAULTS
  );

  const hasSavePlotAutofill = Object.keys(autofill.savePlot).length > 0;
  /*
   * When library autofill runs, do not seed prior CTS/SAC into the base — those
   * stick after delete. Start from defaults + non-library fields on the draft,
   * then overlay merge; replace-keys force empty clears below.
   */
  const baseSavePlot = hasSavePlotAutofill
    ? {
        ...SAVE_PLOT_DEFAULTS,
        ...pickManualSavePlotFields(existingSavePlot),
      }
    : {
        ...SAVE_PLOT_DEFAULTS,
        ...existingSavePlot,
      };

  const savePlotDraft = enrichSavePlotLocation(
    mergeDefined(baseSavePlot, autofill.savePlot)
  ) as Record<string, unknown>;

  for (const key of LIBRARY_REPLACE_SAVE_PLOT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(autofill.savePlot, key)) continue;
    const value = autofill.savePlot[key];
    if (key === "proposedCtsNumber") {
      savePlotDraft.proposedCtsNumber = sanitizeCtsNumbers(value);
    } else if (key === "sacNo") {
      savePlotDraft.sacNo = sanitizeSacNumbers(value);
    } else {
      savePlotDraft[key] = typeof value === "string" ? value : value ?? "";
    }
  }

  if (savePlotDraft.proposedCtsNumber != null) {
    savePlotDraft.proposedCtsNumber = sanitizeCtsNumbers(
      savePlotDraft.proposedCtsNumber
    );
  }
  if (savePlotDraft.sacNo != null) {
    savePlotDraft.sacNo = sanitizeSacNumbers(savePlotDraft.sacNo);
  }

  saveDraft("draft-project-details-save-plot", savePlotDraft);

  const existingProject = loadDraft<Record<string, unknown>>(
    "draft-project-details-project",
    PROJECT_DEFAULTS
  );
  // Create Project locks name/address to the logged-in profile — never overwrite from docs.
  const {
    fullNameOfApplicant: _ignoredFullName,
    addressOfApplicant: _ignoredAddress,
    ...projectInfoPatch
  } = autofill.projectInfo;
  const projectDraft = mergeDefined(
    { ...PROJECT_DEFAULTS, ...existingProject },
    projectInfoPatch
  );
  saveDraft("draft-project-details-project", projectDraft);

  const existingApplicant = loadDraft<Record<string, unknown>>(
    "draft-applicant-details-form",
    APPLICANT_DEFAULTS
  );
  const applicantDraft = mergeDefined(
    { ...APPLICANT_DEFAULTS, ...existingApplicant },
    autofill.applicant
  );
  saveDraft("draft-applicant-details-form", applicantDraft);

  saveDraft("dirty-project-details", true);
  saveDraft("dirty-applicant-details", true);
  saveDraft("project-library-autofill-at", Date.now());

  notifyProjectAutofillApplied();
}

/** Keep user/manual Save Plot fields when rebuilding from library defaults. */
function pickManualSavePlotFields(
  existing: Record<string, unknown>
): Record<string, unknown> {
  const keep = [
    "projectProponent",
    "roadName",
    "majorUseOfPlot",
    "plotSubUse",
    "plotNo",
    "isInternalRoadPresent",
    "plotType",
    "plotEntries",
    "plotBelongsTo",
  ] as const;
  const out: Record<string, unknown> = {};
  for (const key of keep) {
    if (existing[key] !== undefined) out[key] = existing[key];
  }
  return out;
}
