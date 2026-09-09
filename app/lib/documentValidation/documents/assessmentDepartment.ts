import { z } from "zod";
import { wrapDocumentPrompt } from "../promptBase";
import type { DocumentDefinition } from "../types";

const field = () => z.string().nullish();

export const assessmentDepartmentSchema = z.object({
  sacNo: field(),
});

export type AssessmentDepartment = z.infer<typeof assessmentDepartmentSchema>;

const FIELD_RULES = `
Extract from BMC / Brihanmumbai Municipal Corporation Assessment & Collection Department documents
(No Dues Certificate, Annexure "A" capital-value calculation, property tax assessment notices, etc.).

1. sacNo — Every SAC / Prop A/C / Assessment Account number found in the document.
   Format is exactly 2 capital letters followed by 13 digits (e.g. LX1302080120000).
   Look for labels such as: SAC NO, SACNo, SAC No., Prop A/C No., Property Account No.
   If multiple distinct SAC numbers appear, return them comma-separated with no duplicates.
   Do not invent SAC numbers. Do not include ward codes, dates, or other identifiers.
`;

function buildAssessmentDepartmentPrompt(documentText: string): string {
  return wrapDocumentPrompt({
    task: "an Assessment & Collection Department property document",
    fieldRules: FIELD_RULES,
    documentText:
      documentText.trim() ||
      "[Document provided as attached PDF. Extract all SAC / Prop A/C numbers.]",
  });
}

export const assessmentDepartment: DocumentDefinition<
  typeof assessmentDepartmentSchema
> = {
  id: "assessment-department",
  label: "Assessment Department",
  schema: assessmentDepartmentSchema,
  buildPrompt: buildAssessmentDepartmentPrompt,
  validation: {
    alternativeFieldGroups: [
      {
        fields: ["sacNo"],
        missingLabel: "sacNo",
      },
    ],
    optionalFields: [],
  },
};
