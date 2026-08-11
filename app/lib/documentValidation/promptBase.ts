/**
 * Shared extraction prompt scaffolding.
 * Document modules supply task + fieldRules; this wraps common rules + text fence.
 */

const IMPORTANT_RULES = `IMPORTANT RULES

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
- Extract only values explicitly present in the document.`;

export function wrapDocumentPrompt(options: {
  task: string;
  fieldRules: string;
  documentText: string;
}): string {
  const { task, fieldRules, documentText } = options;

  return `
You are an expert AI document extraction engine.

Your task is to extract structured information from ${task}.

${IMPORTANT_RULES}

FIELD EXTRACTION RULES

${fieldRules.trim()}

Document Text:

"""
${documentText}
"""
`;
}
