import { z } from "zod";
import { wrapDocumentPrompt } from "../promptBase";
import type { DocumentDefinition } from "../types";

export const signatoryPhotoSchema = z.object({
  isPortraitPhoto: z.string().nullable(),
});

export type SignatoryPhoto = z.infer<typeof signatoryPhotoSchema>;

const FIELD_RULES = `
1. isPortraitPhoto
- Return exactly "yes" if the image is a passport-style portrait / headshot of a person (face clearly visible).
- Return exactly "no" if the image is a handwritten signature, full identity document scan, certificate, logo, landscape, or anything other than a standalone portrait photo.
- Do not guess — if unsure, return "no".
`;

function buildSignatoryPhotoPrompt(documentText: string): string {
  return wrapDocumentPrompt({
    task: "a standalone authorized signatory portrait photograph",
    fieldRules: FIELD_RULES,
    documentText:
      documentText.trim() ||
      "[Image provided. Classify whether this is a passport-style portrait photograph suitable for an authorized signatory photo upload.]",
  });
}

export const signatoryPhoto: DocumentDefinition<typeof signatoryPhotoSchema> = {
  id: "signatory-photo",
  label: "Authorized Signatory Photograph",
  schema: signatoryPhotoSchema,
  buildPrompt: buildSignatoryPhotoPrompt,
};
