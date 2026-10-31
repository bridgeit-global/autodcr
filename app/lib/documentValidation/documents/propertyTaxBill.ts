import { z } from "zod";
import { wrapDocumentPrompt } from "../promptBase";
import type { DocumentDefinition } from "../types";

const field = () => z.string().nullish();

export const propertyTaxBillSchema = z.object({
  sacNo: field(),
});

export type PropertyTaxBill = z.infer<typeof propertyTaxBillSchema>;

const FIELD_RULES = `
Extract from BMC / Brihanmumbai Municipal Corporation Property Tax Bill documents
(property tax bill / देयक / tax demand bill / current year property tax bill).

1. sacNo — Every SAC / Prop A/C / Assessment Account / property account number found in the document.
   Format is exactly 2 capital letters followed by 13 digits (e.g. LX1302080120000).
   Look for labels such as: SAC NO, SACNo, SAC No., Prop A/C No., Property Account No., लेखा क्रमांक.
   If multiple distinct SAC numbers appear, return them comma-separated with no duplicates.
   Do not invent SAC numbers. Do not include ward codes, bill numbers, dates, or other identifiers.
`;

function buildPropertyTaxBillPrompt(documentText: string): string {
  return wrapDocumentPrompt({
    task: "a BMC Property Tax Bill",
    fieldRules: FIELD_RULES,
    documentText:
      documentText.trim() ||
      "[Document provided as attached PDF. Extract all SAC / Prop A/C numbers.]",
  });
}

export const propertyTaxBill: DocumentDefinition<
  typeof propertyTaxBillSchema
> = {
  id: "property-tax-bill",
  label: "Property Tax Bill",
  schema: propertyTaxBillSchema,
  buildPrompt: buildPropertyTaxBillPrompt,
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
