import { z } from "zod";
import { wrapDocumentPrompt } from "../promptBase";
import type { DocumentDefinition } from "../types";

const field = () => z.string().nullish();

export const airportAuthorityOfIndiaSchema = z.object({
  validUpTo: field(),
});

export type AirportAuthorityOfIndia = z.infer<
  typeof airportAuthorityOfIndiaSchema
>;

const FIELD_RULES = `
Extract from an Airport Authority of India (AAI) / SNCR NOC or height clearance certificate.

1. validUpTo — The document validity end date labeled "Valid up to", "Valid Upto", "Validity", or similar.
   Prefer the printed date exactly as DD-MM-YYYY (e.g. 03-07-2022).
   If only one clear validity/expiry date is present, use that.
   Do not invent dates. Do not use issue / application / print dates when a Valid-up-to date is present.
`;

function buildAirportAuthorityOfIndiaPrompt(documentText: string): string {
  return wrapDocumentPrompt({
    task: "an Airport Authority of India (AAI) / SNCR clearance certificate",
    fieldRules: FIELD_RULES,
    documentText:
      documentText.trim() ||
      "[Document provided as attached PDF (often scanned). Extract the Valid up to / validity end date.]",
  });
}

export const airportAuthorityOfIndia: DocumentDefinition<
  typeof airportAuthorityOfIndiaSchema
> = {
  id: "airport-authority-of-india",
  label: "Airport Authority of India",
  schema: airportAuthorityOfIndiaSchema,
  buildPrompt: buildAirportAuthorityOfIndiaPrompt,
  validation: {
    alternativeFieldGroups: [
      {
        fields: ["validUpTo"],
        missingLabel: "validUpTo",
      },
    ],
    optionalFields: [],
  },
};
