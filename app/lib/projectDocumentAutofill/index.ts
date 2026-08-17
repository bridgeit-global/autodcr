import { mergeApplicant } from "./mergeApplicant";
import { computeAreaTotals, mergeAreaPlots } from "./mergeAreaPlots";
import { mergeProjectInfo } from "./mergeProjectInfo";
import { mergeSavePlot } from "./mergeSavePlot";
import type { ProjectAutofillResult, ProjectLibraryExtraction } from "./types";

export { applyProjectAutofillDrafts } from "./applyDrafts";
export {
  PROJECT_LIBRARY_AUTOFILL_EVENT,
  notifyProjectAutofillApplied,
  subscribeProjectAutofillApplied,
} from "./hydration";

export function buildProjectAutofillFromExtractions(
  extractions: ProjectLibraryExtraction[],
  options?: { leafOnly?: boolean }
): ProjectAutofillResult {
  const areaPlots = mergeAreaPlots(extractions, options);
  const areaTotals = computeAreaTotals(areaPlots);
  const savePlot = mergeSavePlot(extractions);
  const projectInfo = mergeProjectInfo(extractions);
  const applicant = mergeApplicant(extractions);

  return {
    areaPlots,
    areaTotals,
    savePlot,
    projectInfo,
    applicant,
  };
}

export type {
  ApplicantDraftPatch,
  AreaExtractRow,
  AreaPlotRow,
  ProjectAutofillResult,
  ProjectInfoDraftPatch,
  ProjectLibraryDocSlot,
  ProjectLibraryExtraction,
  SavePlotDraftPatch,
} from "./types";
export { buildProjectAutofillFromExtractions as default };
