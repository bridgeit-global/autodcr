import {
  composeAddressLines,
  getPhoneFromMetadata,
  getRegistrationCompleteness,
  normalizePhone,
  normalizeRegNo,
} from "@/app/utils/consultantRegistrationShared";

export const INDIVIDUAL_ENTITY_TYPE = "Individual";

export function isIndividualType(t: string): boolean {
  return t === INDIVIDUAL_ENTITY_TYPE;
}

export const OWNER_ENTITY_TYPE_OPTIONS = [
  "Proprietorship",
  "Individual",
  "Partnership Firm",
  "Pvt. Ltd. / Ltd. Company",
  "LLP",
  "Trust / Society",
  "Govt. / PSU / Local Body",
] as const;

export type OwnerEntityType = (typeof OWNER_ENTITY_TYPE_OPTIONS)[number];

/** Form field → auth metadata key for the primary registration number. */
export const OWNER_REGISTRATION_META_BY_TYPE: Record<
  string,
  { formField: string; metaKey: string; dateField: string; dateMetaKey: string; label: string }
> = {
  Proprietorship: {
    formField: "proprietorshipRegistrationNo",
    metaKey: "proprietorship_registration_no",
    dateField: "proprietorshipRegistrationDate",
    dateMetaKey: "proprietorship_registration_date",
    label: "Proprietorship Registration No.",
  },
  Individual: {
    formField: "proprietorshipRegistrationNo",
    metaKey: "proprietorship_registration_no",
    dateField: "proprietorshipRegistrationDate",
    dateMetaKey: "proprietorship_registration_date",
    label: "Registration No.",
  },
  "Partnership Firm": {
    formField: "firmRegistrationNo",
    metaKey: "firm_registration_no",
    dateField: "partnershipRegistrationDate",
    dateMetaKey: "partnership_registration_date",
    label: "Firm Registration No.",
  },
  "Pvt. Ltd. / Ltd. Company": {
    formField: "cin",
    metaKey: "cin",
    dateField: "rocRegistrationDate",
    dateMetaKey: "roc_registration_date",
    label: "CIN",
  },
  LLP: {
    formField: "llpin",
    metaKey: "llpin",
    dateField: "llpIncorporationDate",
    dateMetaKey: "llp_incorporation_date",
    label: "LLPIN",
  },
  "Trust / Society": {
    formField: "trustRegistrationNo",
    metaKey: "trust_registration_no",
    dateField: "trustRegistrationDate",
    dateMetaKey: "trust_registration_date",
    label: "Trust / Society Registration No.",
  },
  "Govt. / PSU / Local Body": {
    formField: "govtRegistrationNo",
    metaKey: "govt_registration_no",
    dateField: "govtRegistrationDate",
    dateMetaKey: "govt_registration_date",
    label: "Govt Registration No.",
  },
};

/** Extra required registration text fields (beyond primary reg + date). */
export const OWNER_EXTRA_REG_REQUIRED_BY_TYPE: Record<string, string[]> = {
  Proprietorship: ["fullNameProprietor"],
  Individual: [],
  "Partnership Firm": ["numberOfPartners"],
  "Pvt. Ltd. / Ltd. Company": ["numberOfDirectors"],
  LLP: ["numberOfDesignatedPartners"],
  "Trust / Society": ["numberOfTrustees"],
  "Govt. / PSU / Local Body": ["departmentName"],
};

export type OwnerEntityDocumentRequirement = {
  id: string;
  label: string;
  required?: boolean;
  accept?: string;
};

/** Entity-specific PDF checklist for Owner/Developer registration. */
export const OWNER_DOC_CHECKLIST: Record<string, OwnerEntityDocumentRequirement[]> = {
  Proprietorship: [
    { id: "individualUtility", label: "Recent Utility Bill / Address Proof", accept: ".pdf" },
  ],
  Individual: [
    { id: "individualUtility", label: "Recent Utility Bill / Address Proof", accept: ".pdf" },
  ],
  "Partnership Firm": [
    { id: "partnershipDeed", label: "Partnership Deed", required: true, accept: ".pdf" },
    { id: "partnershipCert", label: "Firm Registration Certificate", required: true, accept: ".pdf" },
  ],
  "Pvt. Ltd. / Ltd. Company": [
    { id: "companyIncorporationCert", label: "Certificate of Incorporation", required: true, accept: ".pdf" },
    { id: "companyMoaAoa", label: "MoA & AoA (single compiled PDF)", required: true, accept: ".pdf" },
    { id: "companyBoardResolution", label: "Board Resolution authorising signatory", required: true, accept: ".pdf" },
  ],
  LLP: [
    { id: "llpCertificate", label: "LLPIN Allotment / Certificate of Incorporation", required: true, accept: ".pdf" },
    { id: "llpAgreementDoc", label: "LLP Agreement", required: true, accept: ".pdf" },
    { id: "llpResolutionDoc", label: "Resolution / LOA authorising Designated Partner", required: true, accept: ".pdf" },
    { id: "llpEntityPan", label: "Entity PAN Card", required: true, accept: ".pdf" },
    { id: "llpGstCertificate", label: "GST Registration Certificate", required: true, accept: ".pdf" },
  ],
  "Trust / Society": [
    { id: "trustRegistrationCert", label: "Registration Certificate (Trust / Society)", required: true, accept: ".pdf" },
    { id: "trustDeedDoc", label: "Trust Deed / Bye-laws", required: true, accept: ".pdf" },
  ],
  "Govt. / PSU / Local Body": [
    { id: "govOrder", label: "Government Order / Office Order authorising officer", required: true, accept: ".pdf" },
  ],
};

export const OWNER_ENTITY_TYPES_WITH_ENTITY_PAN = new Set(["LLP"]);

export const OWNER_LLP_AUTOFILL_ENTITY_DOC_IDS = new Set([
  "llpCertificate",
  "llpEntityPan",
  "llpGstCertificate",
]);

/** Form entity-doc id → auth metadata URL key. */
export const OWNER_ENTITY_DOC_URL_META_BY_ID: Record<string, string> = {
  individualUtility: "individual_utility_url",
  partnershipDeed: "partnership_deed_url",
  partnershipCert: "partnership_cert_url",
  companyIncorporationCert: "company_incorporation_cert_url",
  companyMoaAoa: "company_moa_aoa_url",
  companyBoardResolution: "company_board_resolution_url",
  llpCertificate: "llp_certificate_url",
  llpAgreementDoc: "llp_agreement_url",
  llpResolutionDoc: "llp_resolution_url",
  llpEntityPan: "llp_entity_pan_url",
  llpGstCertificate: "llp_gst_certificate_url",
  trustRegistrationCert: "trust_registration_cert_url",
  trustDeedDoc: "trust_deed_url",
  govOrder: "gov_order_url",
};

export function ownerUsesEntityPan(entityType: string): boolean {
  return OWNER_ENTITY_TYPES_WITH_ENTITY_PAN.has(entityType);
}

export function isOwnerDocumentsSectionComplete(
  entityType: string,
  data: {
    aadhaarCardFile: File | null;
    panCardFile: File | null;
    authorizedSignatoryPhotoFile: File | null;
    authorizedSignatorySignatureFile: File | null;
    entityDocuments: Record<string, File | null>;
  }
): boolean {
  if (!entityType) return false;
  if (!data.aadhaarCardFile) return false;
  if (!ownerUsesEntityPan(entityType) && !data.panCardFile) return false;
  if (!data.authorizedSignatoryPhotoFile || !data.authorizedSignatorySignatureFile) {
    return false;
  }
  for (const doc of OWNER_DOC_CHECKLIST[entityType] || []) {
    if (!data.entityDocuments[doc.id]) return false;
  }
  return true;
}

export type PartialOwnerPayload = {
  entityType: string;
  entityName?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  city?: string;
  pincode?: string;
  alternatePhone: string;
  pan?: string;
  gstNo?: string;
  addressLine1: string;
  addressLine2?: string;
  addressLine3?: string;
  fullNameProprietor?: string;
  proprietorshipRegistrationNo?: string;
  proprietorshipRegistrationDate?: string;
  firmRegistrationNo?: string;
  partnershipRegistrationDate?: string;
  numberOfPartners?: string;
  cin?: string;
  rocRegistrationDate?: string;
  numberOfDirectors?: string;
  llpin?: string;
  llpIncorporationDate?: string;
  numberOfDesignatedPartners?: string;
  trustRegistrationNo?: string;
  trustRegistrationDate?: string;
  numberOfTrustees?: string;
  departmentName?: string;
  govtRegistrationNo?: string;
  govtRegistrationDate?: string;
  letterheadUrl?: string;
};

export function getOwnerRegistrationNumberFromMetadata(
  meta: Record<string, unknown> | null | undefined,
  entityType?: string
): string {
  if (!meta) return "";
  const type = entityType || String(meta.entity_type || "");
  const mapping = OWNER_REGISTRATION_META_BY_TYPE[type];
  if (mapping) {
    return normalizeRegNo(String(meta[mapping.metaKey] || ""));
  }
  for (const { metaKey } of Object.values(OWNER_REGISTRATION_META_BY_TYPE)) {
    const v = normalizeRegNo(String(meta[metaKey] || ""));
    if (v) return v;
  }
  return "";
}

export function getPrimaryOwnerRegNoFromPayload(data: PartialOwnerPayload): string {
  const mapping = OWNER_REGISTRATION_META_BY_TYPE[data.entityType];
  if (!mapping) return "";
  const value = (data as Record<string, string | undefined>)[mapping.formField];
  return normalizeRegNo(value);
}

export type PrincipalAccountRole = "Owner" | "Developer";

export function buildPartialOwnerMetadata(
  data: PartialOwnerPayload,
  accountRole: PrincipalAccountRole = "Owner"
): Record<string, unknown> {
  const fullAddress = composeAddressLines(
    data.addressLine1 || "",
    data.addressLine2 || "",
    data.addressLine3 || ""
  );
  const base: Record<string, unknown> = {
    entity_type: data.entityType,
    entity_name: data.entityName || null,
    first_name: data.firstName,
    middle_name: data.middleName || null,
    last_name: data.lastName,
    role: accountRole,
    email: data.email,
    city: data.city || null,
    pincode: data.pincode || null,
    address: fullAddress,
    address_line1: data.addressLine1 || null,
    address_line2: data.addressLine2 || null,
    address_line3: data.addressLine3 || null,
    gst_no: data.gstNo || null,
    alternate_phone: data.alternatePhone || null,
    pan: data.pan || null,
    registration_status: "incomplete",
    status: "pending",
    ...(data.letterheadUrl ? { letterhead_url: data.letterheadUrl } : {}),
  };

  switch (data.entityType) {
    case "Proprietorship":
      if (data.fullNameProprietor) {
        base.full_name_proprietor = data.fullNameProprietor;
      }
      if (data.proprietorshipRegistrationNo) {
        base.proprietorship_registration_no = data.proprietorshipRegistrationNo;
      }
      if (data.proprietorshipRegistrationDate) {
        base.proprietorship_registration_date =
          data.proprietorshipRegistrationDate;
      }
      break;
    case "Individual":
      if (data.proprietorshipRegistrationNo) {
        base.proprietorship_registration_no = data.proprietorshipRegistrationNo;
      }
      if (data.proprietorshipRegistrationDate) {
        base.proprietorship_registration_date =
          data.proprietorshipRegistrationDate;
      }
      break;
    case "Partnership Firm":
      if (data.firmRegistrationNo) {
        base.firm_registration_no = data.firmRegistrationNo;
      }
      if (data.partnershipRegistrationDate) {
        base.partnership_registration_date = data.partnershipRegistrationDate;
      }
      if (data.numberOfPartners) {
        base.number_of_partners = data.numberOfPartners;
      }
      break;
    case "Pvt. Ltd. / Ltd. Company":
      if (data.cin) base.cin = data.cin;
      if (data.rocRegistrationDate) {
        base.roc_registration_date = data.rocRegistrationDate;
      }
      if (data.numberOfDirectors) {
        base.number_of_directors = data.numberOfDirectors;
      }
      break;
    case "LLP":
      if (data.llpin) base.llpin = data.llpin;
      if (data.llpIncorporationDate) {
        base.llp_incorporation_date = data.llpIncorporationDate;
      }
      if (data.numberOfDesignatedPartners) {
        base.number_of_designated_partners = data.numberOfDesignatedPartners;
      }
      break;
    case "Trust / Society":
      if (data.trustRegistrationNo) {
        base.trust_registration_no = data.trustRegistrationNo;
      }
      if (data.trustRegistrationDate) {
        base.trust_registration_date = data.trustRegistrationDate;
      }
      if (data.numberOfTrustees) {
        base.number_of_trustees = data.numberOfTrustees;
      }
      break;
    case "Govt. / PSU / Local Body":
      if (data.departmentName) {
        base.department_name = data.departmentName;
      }
      if (data.govtRegistrationNo) {
        base.govt_registration_no = data.govtRegistrationNo;
      }
      if (data.govtRegistrationDate) {
        base.govt_registration_date = data.govtRegistrationDate;
      }
      break;
  }

  return base;
}

export function ownerMetadataToFormFields(
  meta: Record<string, unknown>
): Record<string, string> {
  return {
    entityType: String(meta.entity_type || ""),
    entityName: String(meta.entity_name || ""),
    firstName: String(meta.first_name || ""),
    middleName: String(meta.middle_name || ""),
    lastName: String(meta.last_name || ""),
    email: String(meta.email || ""),
    city: String(meta.city || ""),
    pincode: String(meta.pincode || ""),
    alternatePhone: getPhoneFromMetadata(meta),
    pan: String(meta.pan || ""),
    gstNo: String(meta.gst_no || ""),
    addressLine1: String(meta.address_line1 || ""),
    addressLine2: String(meta.address_line2 || ""),
    addressLine3: String(meta.address_line3 || ""),
    fullNameProprietor: String(meta.full_name_proprietor || ""),
    proprietorshipRegistrationNo: String(meta.proprietorship_registration_no || ""),
    proprietorshipRegistrationDate: String(meta.proprietorship_registration_date || ""),
    firmRegistrationNo: String(meta.firm_registration_no || ""),
    partnershipRegistrationDate: String(meta.partnership_registration_date || ""),
    numberOfPartners: String(meta.number_of_partners || ""),
    cin: String(meta.cin || ""),
    rocRegistrationDate: String(meta.roc_registration_date || ""),
    numberOfDirectors: String(meta.number_of_directors || ""),
    llpin: String(meta.llpin || ""),
    llpIncorporationDate: String(meta.llp_incorporation_date || ""),
    numberOfDesignatedPartners: String(meta.number_of_designated_partners || ""),
    trustRegistrationNo: String(meta.trust_registration_no || ""),
    trustRegistrationDate: String(meta.trust_registration_date || ""),
    numberOfTrustees: String(meta.number_of_trustees || ""),
    departmentName: String(meta.department_name || ""),
    govtRegistrationNo: String(meta.govt_registration_no || ""),
    govtRegistrationDate: String(meta.govt_registration_date || ""),
  };
}

export const PARTIAL_OWNER_LOCKED_FIELDS = new Set([
  "entityType",
  "entityName",
  "firstName",
  "middleName",
  "lastName",
  "email",
  "alternatePhone",
  "addressLine1",
]);

export function isPartialOwnerField(field: string): boolean {
  return PARTIAL_OWNER_LOCKED_FIELDS.has(field);
}

export {
  getRegistrationCompleteness,
  normalizePhone,
  normalizeRegNo,
  getPhoneFromMetadata,
};
