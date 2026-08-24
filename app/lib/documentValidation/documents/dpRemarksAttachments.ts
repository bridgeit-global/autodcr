import { z } from "zod";
import { wrapDocumentPrompt } from "../promptBase";
import type { DocumentDefinition } from "../types";

/** Companion DP sheets are stored only — no field extraction. */
const field = () => z.string().nullish();

export const dpRemarksAttachmentSchema = z.object({
  documentKind: field(),
});

export type DpRemarksAttachment = z.infer<typeof dpRemarksAttachmentSchema>;

function buildAttachmentPrompt(task: string, documentText: string): string {
  return wrapDocumentPrompt({
    task,
    fieldRules: `
This document is a BMC / MCGM Development Plan companion sheet (map or road-line plan), not the DP remarks letter.

1. documentKind — "map" or "rl" if clearly identifiable; else null.
Do not extract planning, CTS, zone, or applicant fields from this sheet.
`,
    documentText:
      documentText.trim() ||
      "[Document provided as attached PDF. Identify sheet kind only.]",
  });
}

const attachmentValidation = {
  optionalFields: ["documentKind"] as const,
};

export const dpRemarksMap: DocumentDefinition<typeof dpRemarksAttachmentSchema> =
  {
    id: "dp-remarks-map",
    label: "D.P. Remarks — Map Plan",
    schema: dpRemarksAttachmentSchema,
    buildPrompt: (documentText) =>
      buildAttachmentPrompt(
        "a D.P. Remarks Map Plan (BLOCK PLAN / LOCATION PLAN)",
        documentText
      ),
    validation: attachmentValidation,
  };

export const dpRemarksRl: DocumentDefinition<typeof dpRemarksAttachmentSchema> =
  {
    id: "dp-remarks-rl",
    label: "D.P. Remarks — Road Line Plan",
    schema: dpRemarksAttachmentSchema,
    buildPrompt: (documentText) =>
      buildAttachmentPrompt(
        "a D.P. Remarks Road Line Plan (Traffic / Survey RoadLines)",
        documentText
      ),
    validation: attachmentValidation,
  };
