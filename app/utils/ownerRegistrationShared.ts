import {
  composeAddressLines,
  getPhoneFromMetadata,
  getRegistrationCompleteness,
  normalizePhone,
  normalizeRegNo,
} from "@/app/utils/consultantRegistrationShared";

export const OWNER_ENTITY_TYPE_OPTIONS = [
  "Proprietorship / Individual",
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
  "Proprietorship / Individual": {
    formField: "proprietorshipRegistrationNo",
    metaKey: "proprietorship_registration_no",
    dateField: "proprietorshipRegistrationDate",
    dateMetaKey: "proprietorship_registration_date",
    label: "Proprietorship Registration No.",
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
  "Proprietorship / Individual": ["fullNameProprietor"],
  "Partnership Firm": ["numberOfPartners"],
  "Pvt. Ltd. / Ltd. Company": ["numberOfDirectors"],
  LLP: ["numberOfDesignatedPartners"],
  "Trust / Society": ["numberOfTrustees"],
  "Govt. / PSU / Local Body": ["departmentName"],
};

export type PartialOwnerPayload = {
  entityType: string;
  entityName: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  city: string;
  pincode: string;
  alternatePhone: string;
  pan: string;
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

export function buildPartialOwnerMetadata(
  data: PartialOwnerPayload
): Record<string, unknown> {
  const fullAddress = composeAddressLines(
    data.addressLine1 || "",
    data.addressLine2 || "",
    data.addressLine3 || ""
  );
  const base: Record<string, unknown> = {
    entity_type: data.entityType,
    entity_name: data.entityName,
    first_name: data.firstName,
    middle_name: data.middleName || null,
    last_name: data.lastName,
    role: "Owner",
    email: data.email,
    city: data.city,
    pincode: data.pincode,
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
    case "Proprietorship / Individual":
      base.full_name_proprietor = data.fullNameProprietor || null;
      base.proprietorship_registration_no = data.proprietorshipRegistrationNo;
      base.proprietorship_registration_date = data.proprietorshipRegistrationDate;
      break;
    case "Partnership Firm":
      base.firm_registration_no = data.firmRegistrationNo;
      base.partnership_registration_date = data.partnershipRegistrationDate;
      base.number_of_partners = data.numberOfPartners || null;
      break;
    case "Pvt. Ltd. / Ltd. Company":
      base.cin = data.cin;
      base.roc_registration_date = data.rocRegistrationDate;
      base.number_of_directors = data.numberOfDirectors || null;
      break;
    case "LLP":
      base.llpin = data.llpin;
      base.llp_incorporation_date = data.llpIncorporationDate;
      base.number_of_designated_partners = data.numberOfDesignatedPartners || null;
      break;
    case "Trust / Society":
      base.trust_registration_no = data.trustRegistrationNo;
      base.trust_registration_date = data.trustRegistrationDate;
      base.number_of_trustees = data.numberOfTrustees || null;
      break;
    case "Govt. / PSU / Local Body":
      base.department_name = data.departmentName || null;
      base.govt_registration_no = data.govtRegistrationNo;
      base.govt_registration_date = data.govtRegistrationDate;
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
  "city",
  "pincode",
  "alternatePhone",
  "pan",
  "gstNo",
  "address",
  "addressLine1",
  "addressLine2",
  "addressLine3",
  "fullNameProprietor",
  "proprietorshipRegistrationNo",
  "proprietorshipRegistrationDate",
  "firmRegistrationNo",
  "partnershipRegistrationDate",
  "numberOfPartners",
  "cin",
  "rocRegistrationDate",
  "numberOfDirectors",
  "llpin",
  "llpIncorporationDate",
  "numberOfDesignatedPartners",
  "trustRegistrationNo",
  "trustRegistrationDate",
  "numberOfTrustees",
  "departmentName",
  "govtRegistrationNo",
  "govtRegistrationDate",
  "letterheadFile",
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
