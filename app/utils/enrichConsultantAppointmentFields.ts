import type { TemplateType } from "@/app/templates/templateGenerators";
import {
  addressLinesFromApplicantRecord,
  formatAddressLinesForLetterDisplay,
  pickCityPincodeFromRecord,
  pickEntityNameFromUserMeta,
  stripTrailingAddressPunctuation,
} from "@/app/utils/applicantRecordFields";
import {
  findArchitectApplicantInList,
  findConsultantApplicantInList,
  getConsultantAppointmentFieldKeys,
  templateTypeToPdfTokenSuffix,
} from "@/app/utils/consultantTemplateTokens";
import { resolveConsultantMetadata } from "@/app/utils/resolveConsultantMetadata";
import { createClient } from "@supabase/supabase-js";

type EnrichOpts = {
  projectId: string;
  token: string;
  templateType: TemplateType;
};

function pickUserId(rec: Record<string, unknown> | undefined): string {
  if (!rec) return "";
  const uid = rec.user_id ?? rec.userId;
  return typeof uid === "string" ? uid.trim() : "";
}

/** Address lines from applicant/meta; city/pincode only from applicant_details when provided. */
function applyAddressFields(
  out: Record<string, string | undefined>,
  keys: ReturnType<typeof getConsultantAppointmentFieldKeys>,
  rec: Record<string, unknown>,
  cityPincodeFromApplicant?: { city: string; pincode: string }
) {
  const parsed = addressLinesFromApplicantRecord(rec);
  const raw1 =
    stripTrailingAddressPunctuation(out[keys.addr1] ?? "") || parsed.line1;
  const raw2 =
    stripTrailingAddressPunctuation(out[keys.addr2] ?? "") || parsed.line2;
  const raw3 =
    stripTrailingAddressPunctuation(out[keys.addr3] ?? "") || parsed.line3;
  // Applications: city/pincode only from applicants table — never from auth metadata.
  const city = cityPincodeFromApplicant?.city ?? "";
  const pincode = cityPincodeFromApplicant?.pincode ?? "";
  const formatted = formatAddressLinesForLetterDisplay(raw1, raw2, raw3, city, pincode);
  if (formatted.line1) out[keys.addr1] = formatted.line1;
  if (formatted.line2) out[keys.addr2] = formatted.line2;
  if (formatted.line3) out[keys.addr3] = formatted.line3;
}

function applyCompanyField(
  out: Record<string, string | undefined>,
  companyKey: string,
  company: string,
  trailingComma: boolean
) {
  if (!company.trim() || out[companyKey]?.trim()) return;
  out[companyKey] = trailingComma ? `${company.trim()},` : company.trim();
}

/**
 * Client company: prefer owner row in applicant_details (`entity_name`), then owner auth metadata.
 */
async function applyOwnerCompanyFields(
  out: Record<string, string | undefined>,
  token: string,
  ownerUserId: string,
  ownerApplicant?: Record<string, unknown>
) {
  const fromApplicant = pickEntityNameFromUserMeta(ownerApplicant);
  if (fromApplicant) {
    applyCompanyField(out, "project_Client_Company_Name", fromApplicant, false);
    if (!out.project_Owner_Approved_For?.trim()) {
      out.project_Owner_Approved_For = `For ${fromApplicant},`;
    }
  }
  if (!ownerUserId.trim()) return;
  if (out.project_Client_Company_Name?.trim()) return;
  const meta = await resolveConsultantMetadata(token, {
    lookupUserIds: [ownerUserId.trim()],
  });
  const company = pickEntityNameFromUserMeta(
    meta as Record<string, unknown> | undefined
  );
  if (!company) return;

  applyCompanyField(out, "project_Client_Company_Name", company, false);
  if (!out.project_Owner_Approved_For?.trim()) {
    out.project_Owner_Approved_For = `For ${company},`;
  }
}

function primaryAddressComplete(
  out: Record<string, string | undefined>,
  keys: ReturnType<typeof getConsultantAppointmentFieldKeys>
): boolean {
  return Boolean(out[keys.addr1]?.trim());
}

/**
 * Fill consultant appointment tokens from merged applicant_details + auth profile
 * when the client preview context missed address (e.g. consultant signing).
 * The owner/client company name uses owner auth metadata only.
 */
export async function enrichConsultantAppointmentFields(
  fields: Record<string, string | undefined>,
  opts: EnrichOpts
): Promise<Record<string, string | undefined>> {
  const out = { ...fields };
  const suffix = templateTypeToPdfTokenSuffix(opts.templateType);
  const primaryKeys = getConsultantAppointmentFieldKeys(suffix);
  const architectKeys = getConsultantAppointmentFieldKeys("Architect");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${opts.token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rpcData } = await supabase.rpc("get_project_for_preview", {
    p_project_id: opts.projectId,
  });

  let applicants: unknown[] = [];
  let architectUserId = "";
  let ownerUserId = "";

  if (rpcData && typeof rpcData === "object" && !Array.isArray(rpcData)) {
    const row = rpcData as {
      architect_user_id?: string | null;
      user_id?: string | null;
      applicant_details?: { applicants?: unknown[] } | null;
    };
    if (typeof row.architect_user_id === "string") {
      architectUserId = row.architect_user_id.trim();
    }
    if (typeof row.user_id === "string") {
      ownerUserId = row.user_id.trim();
    }
    applicants = row.applicant_details?.applicants ?? [];
  }

  const primaryApplicant = findConsultantApplicantInList(applicants, opts.templateType);
  const architectApplicant = findArchitectApplicantInList(applicants);
  const ownerApplicant = applicants.find((a) => {
    if (!a || typeof a !== "object") return false;
    const type = String(
      (a as { applicantType?: string; applicant_type?: string }).applicantType ||
        (a as { applicant_type?: string }).applicant_type ||
        ""
    ).toLowerCase();
    return type.includes("owner");
  }) as Record<string, unknown> | undefined;
  const primaryCityPincode = pickCityPincodeFromRecord(primaryApplicant);
  const architectCityPincode = pickCityPincodeFromRecord(architectApplicant);

  const enrichPrimaryAddress = !primaryAddressComplete(out, primaryKeys);
  const enrichArchitectCc =
    opts.templateType !== "Architect" && !out[architectKeys.addr1]?.trim();

  if (enrichPrimaryAddress && primaryApplicant) {
    applyAddressFields(out, primaryKeys, primaryApplicant, primaryCityPincode);
  }

  if (enrichArchitectCc && architectApplicant) {
    applyAddressFields(out, architectKeys, architectApplicant, architectCityPincode);
  }

  const primaryUserId = pickUserId(primaryApplicant);
  if (enrichPrimaryAddress && primaryUserId) {
    const meta = await resolveConsultantMetadata(opts.token, {
      lookupUserIds: [primaryUserId],
    });
    if (meta) {
      // Address lines may come from meta; city/pincode stay from applicant row only.
      applyAddressFields(
        out,
        primaryKeys,
        meta as Record<string, unknown>,
        primaryCityPincode
      );
      // Licensed Surveyor "To," firm name: consultant profile, not owner.
      if (opts.templateType === "Licensed Surveyor") {
        const company = pickEntityNameFromUserMeta(meta as Record<string, unknown>);
        applyCompanyField(out, primaryKeys.company, company, false);
      }
    }
  }

  if (!architectUserId && architectApplicant) {
    architectUserId = pickUserId(architectApplicant);
  }
  // Architect appointment "To," firm name: architect profile, not owner.
  const enrichArchitectCompany =
    opts.templateType === "Architect" && !out[architectKeys.company]?.trim();
  if ((enrichArchitectCc || enrichArchitectCompany) && architectUserId) {
    const meta = await resolveConsultantMetadata(opts.token, {
      lookupUserIds: [architectUserId],
    });
    if (meta) {
      if (enrichArchitectCc) {
        applyAddressFields(
          out,
          architectKeys,
          meta as Record<string, unknown>,
          architectCityPincode
        );
      }
      if (enrichArchitectCompany) {
        const company = pickEntityNameFromUserMeta(meta as Record<string, unknown>);
        applyCompanyField(out, architectKeys.company, company, true);
        if (company.trim() && !out.project_Architect_Approved_For?.trim()) {
          out.project_Architect_Approved_For = `For ${company.trim()},`;
        }
      }
    }
  }

  await applyOwnerCompanyFields(out, opts.token, ownerUserId, ownerApplicant);

  return out;
}
