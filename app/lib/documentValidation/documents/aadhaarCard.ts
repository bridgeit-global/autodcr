import { z } from "zod";
import { wrapDocumentPrompt } from "../promptBase";
import type { DocumentDefinition } from "../types";

export const aadhaarSchema = z.object({
  enrollmentNumber: z.string().nullable(),
  name: z.string().nullable(),
  address: z.string().nullable(),
  contactNumber: z.string().nullable(),
  issueDate: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  yearOfBirth: z.string().nullable(),
  gender: z.string().nullable(),
  aadhaarNumber: z.string().nullable(),
  vid: z.string().nullable(),
  documentId: z.string().nullable(),
  referenceNumber: z.string().nullable(),
  signatureStatus: z.string().nullable(),
  photo: z.string().nullable(),
  qrCode: z.string().nullable(),
  barcode: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  pincode: z.string().nullable(),
});

/** Alias matching the requested schema name. */
export const AadhaarSchema = aadhaarSchema;

export type AadhaarCard = z.infer<typeof aadhaarSchema>;

const FIELD_RULES = `
DOCUMENT CONTEXT

This may be any valid Aadhaar-related document issued by UIDAI / Unique Identification
Authority of India / Government of India, including (but not limited to):
- PVC / plastic Aadhaar card (front and/or back)
- paper Aadhaar letter / enrollment acknowledgement
- e-Aadhaar PDF / download
- Aadhaar with masked number
- older or newer print layouts
- English, Hindi, or bilingual text

LAYOUT-AGNOSTIC RULES (CRITICAL)

- Do NOT assume a single fixed layout, version, language, or field set.
- Do NOT rely on fixed coordinates, page order, or exact text positions.
- Different Aadhaar documents show different subsets of fields. That is normal.
- Identify each field using labels, surrounding text, semantic context, relative
  position near labels, and standard Aadhaar terminology — never by guessing
  from layout habit alone.
- If a field is not present or cannot be confidently identified in THIS document,
  return null for that field. Do not invent values from a "typical" Aadhaar.

FIELD EXTRACTION

1. enrollmentNumber
- Extract only if an enrollment / enrolment number is explicitly present.
- Labels may include: "Enrollment No.", "Enrolment No.", "Enrollment Number".
- Preserve exact characters (including slashes). Do not confuse with Aadhaar number, VID, or reference number.

2. name
- Extract the holder's full name exactly as printed.
- May appear near "Name" / "नाम", near a photograph, or as the primary person name block.
- Do not rewrite or expand initials.

3. address
- Extract the full residential address when present.
- Include all lines that clearly belong to the address block; prefer newlines between lines.
- Do not invent missing locality or PIN.

4. contactNumber
- Extract a phone / mobile / contact number only if explicitly printed and associated with the holder.
- Labels may include: "Mobile", "Phone", "Contact", "मोबाइल".
- Preserve exactly as written. If absent, return null.

5. issueDate
- Extract an issue / generated / printed date for the Aadhaar document if present.
- Labels may include: "Issue Date", "Issued On", "Date of Issue", "Generated On".
- Preserve exactly as written. Do not normalize. Do not confuse with DOB.

6. dateOfBirth
- Extract full date of birth only when a full date is printed.
- Labels may include: "DOB", "Date of Birth", "जन्म तिथि".
- Preserve exactly as written. Do not normalize.
- If only a year is shown (no full date), leave dateOfBirth null and use yearOfBirth.

7. yearOfBirth
- Extract year of birth when a year-only value is printed, or when YOB is explicitly labeled.
- Labels may include: "Year of Birth", "YOB", "जन्म वर्ष".
- If a full DOB is present and no separate YOB is printed, you may set yearOfBirth to the year portion only when that year is explicitly readable; otherwise prefer dateOfBirth and set yearOfBirth null if YOB is not separately shown.
- Preserve as written. Do not invent.

8. gender
- Extract gender exactly as printed (Male / Female / Transgender, M / F, or Hindi equivalents).
- Labels may include: "Gender" / "लिंग".

9. aadhaarNumber
- Extract the 12-digit Aadhaar number when present.
- Labels may include: "Your Aadhaar No.", "Aadhaar No.", "Aadhaar", "आधार संख्या".
- Preserve digits and spacing exactly as printed (e.g. XXXX XXXX XXXX).
- Masked forms (e.g. XXXX XXXX 1234) are valid — return exactly; NEVER invent hidden digits.

10. vid
- Extract Virtual ID (VID) only if explicitly present and distinguishable from Aadhaar number.
- Labels may include: "VID", "Virtual ID".
- Preserve exactly as written. If absent, return null.

11. documentId
- Extract a document / download / acknowledgment id only if distinctly labeled and
  different from aadhaarNumber, vid, enrollmentNumber, and referenceNumber.
- If not confidently identifiable, return null.

12. referenceNumber
- Extract a reference number only if distinctly labeled (e.g. "Reference No.", "Ref No.").
- Do not substitute enrollmentNumber, documentId, vid, or aadhaarNumber.
- If absent, return null.

13. signatureStatus
- If a handwritten / digital signature mark of the holder or issuing authority is clearly visible,
  return exactly: present
- If text such as "Signature not required" / similar status text is printed, return that text exactly.
- If neither is clearly present, return null.
- Do not invent a signed name.

14. photo
- If a holder photograph is clearly visible, return exactly: present
- Otherwise return null. Do not invent identity details from the photo.

15. qrCode
- If a QR code is clearly visible, return exactly: present
- Do not invent decoded QR payload unless also printed as readable text.
- Otherwise return null.

16. barcode
- If a linear / 1D barcode is clearly visible, return exactly: present
- Do not invent decoded barcode text unless also printed as readable text.
- Otherwise return null.

17. city
- Extract the city / town / locality ONLY if it is explicitly printed on the document
  (often within the address block, or near City / District / शहर labels).
- Preserve exactly as written. Do not invent from external geography or Aadhaar knowledge.
- If not present or not confidently identifiable, return null.
Example:
Mumbai

18. state
- Extract the state / UT ONLY if it is explicitly printed on the document
  (often within the address block, or near State / राज्य labels).
- Preserve exactly as written. Do not assume any state.
- If not present or not confidently identifiable, return null.
Example:
Maharashtra

19. pincode
- Extract a 6-digit Indian PIN / postal code ONLY if it is explicitly printed on the document.
- Labels may include "PIN", "PIN Code", "Pincode", or it may appear in the address line.
- Preserve digits exactly as written. Do not invent a PIN.
- If not present or not confidently identifiable, return null.
Example:
400070

DISAMBIGUATION

- aadhaarNumber ≠ vid ≠ enrollmentNumber ≠ referenceNumber ≠ documentId
- dateOfBirth ≠ yearOfBirth ≠ issueDate
- city / state / pincode must come from printed text only — never from external knowledge
- Never fill masked digits.
- Ignore UIDAI / Government of India branding that is not one of the fields above.
- Never guess. Prefer null over an uncertain value.
`;

function buildAadhaarPrompt(documentText: string): string {
  return wrapDocumentPrompt({
    task: "an Indian Aadhaar document (any valid UIDAI layout / version / language)",
    fieldRules: FIELD_RULES,
    documentText:
      documentText.trim() ||
      "[Document provided as attached image/PDF. Extract fields from whatever layout is shown. Do not assume a fixed Aadhaar template.]",
  });
}

export const aadhaarCard: DocumentDefinition<typeof aadhaarSchema> = {
  id: "aadhaar",
  label: "Aadhaar Card",
  schema: aadhaarSchema,
  buildPrompt: buildAadhaarPrompt,
  validation: {
    alternativeFieldGroups: [
      {
        fields: ["dateOfBirth", "yearOfBirth"],
        missingLabel: "Date of Birth / Year of Birth",
      },
    ],
    optionalFields: [
      "enrollmentNumber",
      "address",
      "contactNumber",
      "issueDate",
      "gender",
      "vid",
      "documentId",
      "referenceNumber",
      "signatureStatus",
      "photo",
      "qrCode",
      "barcode",
      "city",
      "state",
      "pincode",
    ],
  },
};
