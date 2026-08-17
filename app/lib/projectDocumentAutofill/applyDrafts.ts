import { loadDraft, saveDraft } from "@/app/utils/draftStorage";
import type { ProjectAutofillResult } from "./types";
import { notifyProjectAutofillApplied } from "./hydration";
import { enrichSavePlotLocation, sanitizeCtsNumbers } from "./utils";

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

/** Write merged autofill into Create Project draft keys and mark downstream sections dirty. */
export function applyProjectAutofillDrafts(autofill: ProjectAutofillResult): void {
  if (autofill.areaPlots.length > 0) {
    saveDraft("draft-area-details-plots", autofill.areaPlots);
    saveDraft("draft-area-details-totals", autofill.areaTotals);
    saveDraft("dirty-area-details", true);
  }

  const existingSavePlot = loadDraft<Record<string, unknown>>(
    "draft-project-details-save-plot",
    SAVE_PLOT_DEFAULTS
  );
  const rawCts = existingSavePlot.proposedCtsNumber;
  const normalizedCts = Array.isArray(rawCts)
    ? rawCts.map(String)
    : typeof rawCts === "string" && rawCts
      ? [rawCts]
      : [];

  const hasSavePlotAutofill = Object.keys(autofill.savePlot).length > 0;
  const savePlotDraft = enrichSavePlotLocation(
    mergeDefined(
      hasSavePlotAutofill
        ? { ...SAVE_PLOT_DEFAULTS, proposedCtsNumber: normalizedCts.length ? normalizedCts : [] }
        : { ...SAVE_PLOT_DEFAULTS, ...existingSavePlot, proposedCtsNumber: normalizedCts },
      autofill.savePlot
    )
  );
  if (savePlotDraft.proposedCtsNumber) {
    savePlotDraft.proposedCtsNumber = sanitizeCtsNumbers(savePlotDraft.proposedCtsNumber);
  }
  saveDraft("draft-project-details-save-plot", savePlotDraft);

  const existingProject = loadDraft<Record<string, unknown>>(
    "draft-project-details-project",
    PROJECT_DEFAULTS
  );
  const projectDraft = mergeDefined(
    { ...PROJECT_DEFAULTS, ...existingProject },
    autofill.projectInfo
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
