import type { DocumentType } from "@/app/lib/documentValidation/registry";

export type ProjectLibraryDocSlot =
  | "pr-primary"
  | "pr-extra"
  | "dp-remarks"
  | "crz-remarks"
  | "power-of-attorney";

export type ProjectLibraryExtraction = {
  slot: ProjectLibraryDocSlot;
  documentType: DocumentType;
  label: string;
  valid: boolean;
  missingFields: string[];
  extracted: Record<string, string | null>;
};

export type AreaExtractRow = {
  id: string;
  extractNo: string;
  prcArea: string;
  ulcArea: string;
  bFormArea: string;
  conveyanceArea: string;
  attorneyArea: string;
  dilrMapArea: string;
  leaseArea: string;
};

export type AreaPlotRow = {
  id: string;
  plotNumber: string;
  plotName: string;
  ownerName: string;
  type: "7/12" | "PRC" | "";
  extractCount: string;
  area: string;
  extracts: AreaExtractRow[];
};

export type SavePlotDraftPatch = Record<string, unknown>;

export type ProjectInfoDraftPatch = {
  propertyAddress?: string;
  landmark?: string;
  pincode?: string;
  fullNameOfApplicant?: string;
  addressOfApplicant?: string;
};

export type ApplicantDraftPatch = {
  applicantType?: string;
  name?: string;
  residentialAddress?: string;
  panNo?: string;
};

export type ProjectAutofillResult = {
  areaPlots: AreaPlotRow[];
  areaTotals: {
    allPlotsTotal: {
      prcArea: number;
      ulcArea: number;
      bFormArea: number;
      conveyanceArea: number;
      attorneyArea: number;
      dilrMapArea: number;
      leaseArea: number;
    };
    totalLeaseArea: number;
  };
  savePlot: SavePlotDraftPatch;
  projectInfo: ProjectInfoDraftPatch;
  applicant: ApplicantDraftPatch;
};

export const LOCATION_KEYS = [
  "planningAuthority",
  "region",
  "zone",
  "ward",
] as const;

/** Fields POA must not overwrite — village/CTS come from PR/DP/CRZ, not street names. */
export const POA_STRIP_KEYS = [
  ...LOCATION_KEYS,
  "villageName",
  "proposedCtsNumber",
  "dpZone",
  "plotBelongsTo",
] as const;
