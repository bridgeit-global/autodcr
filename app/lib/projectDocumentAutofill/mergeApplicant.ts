import type { ApplicantDraftPatch, ProjectLibraryExtraction } from "./types";
import { pickString } from "./utils";

function applicantFromExtracted(
  extracted: Record<string, string | null>
): ApplicantDraftPatch {
  const patch: ApplicantDraftPatch = {};
  const name = pickString(
    extracted.applicantName,
    extracted.fullNameOfApplicant,
    extracted.principalName,
    extracted.attorneyName
  );
  const address = pickString(
    extracted.applicantAddress,
    extracted.addressOfApplicant,
    extracted.propertyAddress
  );
  const applicantType = pickString(extracted.applicantType);
  const panNo = pickString(extracted.panNo);

  if (name) patch.name = name;
  if (address) patch.residentialAddress = address;
  if (applicantType) patch.applicantType = applicantType;
  if (panNo) patch.panNo = panNo;

  return patch;
}

/** Applicant priority: DP → POA → PRC-with-location PR cards. */
export function mergeApplicant(
  extractions: ProjectLibraryExtraction[]
): ApplicantDraftPatch {
  let merged: ApplicantDraftPatch = {};

  const dp = extractions.find((e) => e.documentType === "dp-remarks");
  const poa = extractions.find((e) => e.documentType === "power-of-attorney");

  if (dp) merged = { ...merged, ...applicantFromExtracted(dp.extracted) };
  if (poa) merged = { ...merged, ...applicantFromExtracted(poa.extracted) };

  return merged;
}
