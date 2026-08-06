/**
 * Document schemas and extraction prompts.
 * Ported from AI_SDK — adding a document type only needs schema + prompt + registry entry.
 */
import { z } from "zod";

export type DocumentDefinition<T extends z.ZodTypeAny> = {
  id: string;
  label: string;
  schema: T;
  buildPrompt: (documentText: string) => string;
};

export const architectAppointmentLetterSchema = z.object({
  date: z.string().nullable(),
  architectName: z.string().nullable(),
  address: z.string().nullable(),
  ctsNumber: z.string().nullable(),
  area: z.string().nullable(),
  propertyIdentifier: z.string().nullable(),
  ward: z.string().nullable(),
  proposalNumber: z.string().nullable(),
  directorName: z.string().nullable(),
  coaRegistrationNumber: z.string().nullable(),
  coaValidUpto: z.string().nullable(),
  ccTo: z.string().nullable(),
});

export type ArchitectAppointmentLetter = z.infer<
  typeof architectAppointmentLetterSchema
>;

function buildArchitectAppointmentLetterPrompt(documentText: string): string {
  return `
You are an expert AI document extraction engine.

Your task is to extract structured information from an Architect Appointment Letter.

IMPORTANT RULES

- Return ONLY the structured object defined by the schema.
- Never hallucinate.
- Never guess.
- Never infer missing values.
- If a value cannot be confidently identified, return null.
- Preserve values exactly as written.
- Preserve original capitalization.
- Preserve original formatting.
- Do not rewrite names.
- Do not normalize dates.
- Do not merge multiple fields.
- Do not split values unless instructed.
- Extract only values explicitly present in the document.

FIELD EXTRACTION RULES

1. date
- Extract the appointment letter date.
- Usually appears near the top of the document.
Example:
01/08/2026

2. architectName
- Extract the architect's full name mentioned in the "To" section.
- Ignore names appearing in digital signatures unless no architect name exists.
Example:
Riyaz Shamsuddin Ansari

3. address
- Full address for the architect / property as written.
Example:
F-53, Kohinoor City Mall, Kirol Road, Off. L.B.S. Marg,Kurla (W), Mumbai-400070.

4. ctsNumber
Extract the value after:

C.T.S. No(s).

Example:

C.T.S. No(s). 1

Return:

1

5. area
Extract the location/area between

"of"

and

"at"

Example:

C.T.S. No(s). 1 of Aarey at d3f44

Return:

Aarey

6. propertyIdentifier
Extract the value between

"at"

and

"in"

Example:

...of Aarey at d3f44 in P/N Ward

Return:

d3f44

7. ward
Extract the value before the word

Ward

Example:

P/N Ward

Return:

P/N Ward

8. proposalNumber
Extract the BMC Proposal Number.

Example:

12122121

9. directorName
Extract the Director / Owner name from the approval section.

Example:

Faisal Aziz Ansari

10. coaRegistrationNumber
Extract the COA Registration Number.

Example:

CA/2020/12345

11. coaValidUpto
Extract the COA Registration validity date.

Example:

21/04/2026

12. ccTo
Extract the full C. C. / carbon-copy recipient block that appears after the label
"C. C. to:" (or "C.C. to:" / "CC to:").
- Include every address line belonging to that block.
- Exclude the trailing note "For information & record please." if present.
- Preserve line breaks as commas or newlines exactly as written when possible;
  prefer keeping the multi-line text joined with newlines.
- Do not include the "C. C. to:" label itself.

Example input:

C. C. to:
The Executive Engineer (E.S.) - I,
O/o The Dy. Ch. Eng. (B.P.) E. S.,
Brihanmumbai Municipal Corporation,
Near Raj Legacy (Residential Complex),
Paper Mill Compound,L. B. S. Marg,
Vikhroli (West), Mumbai - 400 083.
For information & record please.

Example return:

The Executive Engineer (E.S.) - I,
O/o The Dy. Ch. Eng. (B.P.) E. S.,
Brihanmumbai Municipal Corporation,
Near Raj Legacy (Residential Complex),
Paper Mill Compound,L. B. S. Marg,
Vikhroli (West), Mumbai - 400 083.

SPECIAL INSTRUCTIONS

The sentence

"C.T.S. No(s). <CTS> of <Area> at <Property Identifier> in <Ward>"

contains FOUR different fields.

Extract them separately.

Example:

Input:

C.T.S. No(s). 1 of Aarey at d3f44 in P/N Ward

Output:

ctsNumber = "1"

area = "Aarey"

propertyIdentifier = "d3f44"

ward = "P/N Ward"

If any field is absent, return null.

Document Text:

"""
${documentText}
"""
`;
}

export const architectAppointmentLetter: DocumentDefinition<
  typeof architectAppointmentLetterSchema
> = {
  id: "architect-appointment-letter",
  label: "Architect Appointment Letter",
  schema: architectAppointmentLetterSchema,
  buildPrompt: buildArchitectAppointmentLetterPrompt,
};

export const documents = {
  [architectAppointmentLetter.id]: architectAppointmentLetter,
} as const;

export type DocumentType = keyof typeof documents;

/** Maps dashboard application type names to AI document types. */
export const APPLICATION_TYPE_TO_DOCUMENT_TYPE: Record<string, DocumentType> = {
  "Appointment Letter for Architect": "architect-appointment-letter",
};

export function resolveDocumentType(
  applicationTypeName: string
): DocumentType | null {
  return APPLICATION_TYPE_TO_DOCUMENT_TYPE[applicationTypeName] ?? null;
}
