import { formatCoaExpiryDisplay } from "@/app/utils/coaMetadataDisplay";
import type { TemplateType } from "@/app/templates/templateGenerators";
import {
  resolveConsultantMetadata,
  type ResolveConsultantMetadataOptions,
} from "@/app/utils/resolveConsultantMetadata";

function pickMetaString(meta: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = meta[k];
    if (v === null || v === undefined) continue;
    const s = typeof v === "string" ? v.trim() : String(v).trim();
    if (s) return s;
  }
  return "";
}

export async function enrichPreviewDocxFields(
  fields: Record<string, string | undefined>,
  access_token: string,
  options?: ResolveConsultantMetadataOptions,
  templateType?: TemplateType
): Promise<void> {
  try {
    const meta = await resolveConsultantMetadata(access_token.trim(), options);
    if (!meta) return;

    const useLbs = templateType === "Licensed Surveyor";
    const reg = useLbs
      ? pickMetaString(meta, ["lbs_license_no", "LBS_license_no", "lbsLicenseNo"])
      : pickMetaString(meta, ["coa_reg_no", "COA_reg_no", "coaRegNo"]);
    const expIso = useLbs
      ? pickMetaString(meta, ["lbs_expiry_date", "LBS_expiry_date", "lbsExpiryDate"])
      : pickMetaString(meta, ["coa_expiry_date", "COA_expiry_date", "coaExpiryDate"]);
    const expDisplay = formatCoaExpiryDisplay(expIso);

    const regKeys = ["project_RegNo_Architect/L.S.", "project_RegNo_Architect/L.S"] as const;
    const valKeys = ["project_Validity_Architect/L.S.", "project_Validity_Architect/L.S"] as const;

    for (const k of regKeys) {
      if (!fields[k]?.trim() && reg) fields[k] = reg;
    }
    for (const k of valKeys) {
      if (!fields[k]?.trim() && expDisplay) fields[k] = expDisplay;
    }

    const council = fields.CouncilRegNo?.trim();
    const regInvalid = !council || council === "-";
    if (regInvalid && reg) fields.CouncilRegNo = reg;

    const validity = fields.RegValidityDate?.trim();
    const validityInvalid = !validity || validity === "-";
    if (validityInvalid && expDisplay) fields.RegValidityDate = expDisplay;
  } catch {
    /* non-fatal */
  }
}
