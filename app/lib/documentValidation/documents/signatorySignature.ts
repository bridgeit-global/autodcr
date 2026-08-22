import { z } from "zod";
import { wrapDocumentPrompt } from "../promptBase";
import type { DocumentDefinition } from "../types";

export const signatorySignatureSchema = z.object({
  isHandwrittenSignature: z.string().nullable(),
});

export type SignatorySignature = z.infer<typeof signatorySignatureSchema>;

const FIELD_RULES = `
1. isHandwrittenSignature
- Return exactly "yes" if the image shows a handwritten signature (cursive sign, ink on paper/transparent background, digital signature stroke).
- Return exactly "no" if the image is a portrait/face photo, full document, stamp, typed text only, or blank.
- A signature on a plain or dark background counts as "yes".
- Do not guess — if unsure, return "no".
`;

function buildSignatorySignaturePrompt(documentText: string): string {
  return wrapDocumentPrompt({
    task: "a standalone authorized signatory signature image",
    fieldRules: FIELD_RULES,
    documentText:
      documentText.trim() ||
      "[Image provided. Classify whether this is a handwritten signature suitable for an authorized signatory signature upload.]",
  });
}

export const signatorySignature: DocumentDefinition<
  typeof signatorySignatureSchema
> = {
  id: "signatory-signature",
  label: "Authorized Signatory Signature",
  schema: signatorySignatureSchema,
  buildPrompt: buildSignatorySignaturePrompt,
};
