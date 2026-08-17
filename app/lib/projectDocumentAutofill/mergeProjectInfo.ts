import type { ProjectInfoDraftPatch, ProjectLibraryExtraction } from "./types";
import { parsePincode, pickString } from "./utils";

function projectInfoFromExtracted(
  extracted: Record<string, string | null>
): ProjectInfoDraftPatch {
  const patch: ProjectInfoDraftPatch = {};
  const fullName = pickString(extracted.fullNameOfApplicant, extracted.applicantName);
  const address = pickString(extracted.addressOfApplicant, extracted.applicantAddress);
  const propertyAddress = pickString(extracted.propertyAddress);
  const landmark = pickString(extracted.landmark);
  const pincode = pickString(extracted.pincode);

  if (fullName) patch.fullNameOfApplicant = fullName;
  if (address) patch.addressOfApplicant = address;
  if (propertyAddress) patch.propertyAddress = propertyAddress;
  if (landmark) patch.landmark = landmark;
  if (pincode) patch.pincode = pincode;

  return patch;
}

export function mergeProjectInfo(
  extractions: ProjectLibraryExtraction[]
): ProjectInfoDraftPatch {
  let merged: ProjectInfoDraftPatch = {};

  const ordered = [
    ...extractions.filter((e) => e.documentType === "pr-card" && e.slot === "pr-primary"),
    ...extractions.filter((e) => e.documentType === "pr-card" && e.slot === "pr-extra"),
    ...extractions.filter((e) => e.documentType === "dp-remarks"),
    ...extractions.filter((e) => e.documentType === "crz-remarks"),
    ...extractions.filter((e) => e.documentType === "power-of-attorney"),
  ];

  for (const extraction of ordered) {
    merged = { ...merged, ...projectInfoFromExtracted(extraction.extracted) };
  }

  if (!merged.pincode?.trim()) {
    merged.pincode = parsePincode(
      merged.addressOfApplicant,
      merged.propertyAddress,
      ...ordered.flatMap((e) => [
        e.extracted.addressOfApplicant,
        e.extracted.applicantAddress,
        e.extracted.propertyAddress,
        e.extracted.residentialAddress,
      ])
    );
  }

  return merged;
}
