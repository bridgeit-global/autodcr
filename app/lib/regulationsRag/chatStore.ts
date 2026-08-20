import type {
  AskHistoryTurn,
  ChatMessageKind,
  ChatRole,
  ComplianceResult,
  RagSource,
  RegulationChatMessage,
  RegulationChatSummary,
} from "./types";

export const DOCUMENT_TEXT_MAX = 80_000;
export const MAX_PROPOSAL_FILES = 10;

const COMPLIANCE_INTENT =
  /\b(complian(ce|t)?|gap\s*analysis|analy[sz]e(\s+this)?(\s+(proposal|document|pdf))?|run\s+(a\s+)?(compliance\s+)?check|checklist|scrutin[yi])/i;

export function looksLikeComplianceIntent(question: string): boolean {
  return COMPLIANCE_INTENT.test(question.trim());
}

export function resolveTurnIntent(params: {
  question: string;
  hasNewFile: boolean;
  hasStoredDocument: boolean;
}): "ask" | "compliance" {
  const question = params.question.trim();
  if (params.hasNewFile && (!question || looksLikeComplianceIntent(question))) {
    return "compliance";
  }
  if (
    question &&
    looksLikeComplianceIntent(question) &&
    (params.hasNewFile || params.hasStoredDocument)
  ) {
    return "compliance";
  }
  if (question) return "ask";
  if (params.hasNewFile) return "compliance";
  throw new Error("Type a question, or upload a proposal PDF to analyze.");
}

export function formatFilenames(names: string[]): string {
  return names.map((n) => n.trim()).filter(Boolean).join(", ");
}

export function joinExtractedDocuments(
  parts: { filename: string; text: string; pages: number }[]
): { filename: string; text: string; pages: number } {
  const filename = formatFilenames(parts.map((p) => p.filename));
  const text = parts
    .map((p) => {
      const pageLabel = p.pages === 1 ? "1 page" : `${p.pages} pages`;
      return `===== ${p.filename} (${pageLabel}) =====\n${p.text.trim()}`;
    })
    .filter((block) => block.trim())
    .join("\n\n");
  const pages = parts.reduce((sum, p) => sum + p.pages, 0);
  return { filename, text, pages };
}

export function titleFromTurn(question: string, filename?: string | null): string {
  const q = question.trim();
  if (q) return q.slice(0, 80);
  if (filename?.trim()) return `Document · ${filename.trim()}`;
  return "New chat";
}

export function userMessageText(question: string, filename?: string | null): string {
  const q = question.trim();
  if (q) return q;
  if (filename?.trim()) return `Analyze this proposal for compliance (${filename.trim()})`;
  return "Analyze this proposal for compliance";
}

type ChatRow = {
  id: string;
  project_id: string;
  title: string;
  authorities: string[] | null;
  document_filename: string | null;
  document_pages: number | null;
  created_at: string;
  updated_at: string;
};

export function mapChatSummary(row: ChatRow): RegulationChatSummary {
  return {
    id: row.id,
    project_id: row.project_id,
    title: row.title || "New chat",
    authorities: Array.isArray(row.authorities) ? row.authorities : [],
    document_filename: row.document_filename,
    document_pages: row.document_pages,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

type MessageRow = {
  id: string;
  chat_id: string;
  role: string;
  content: string;
  kind: string;
  sources: unknown;
  compliance: unknown;
  filename: string | null;
  error: boolean | null;
  created_at: string;
};

function asRole(value: string): ChatRole {
  return value === "user" ? "user" : "assistant";
}

function asKind(value: string): ChatMessageKind {
  if (value === "ask" || value === "compliance" || value === "document") return value;
  return "text";
}

function asSources(value: unknown): RagSource[] {
  return Array.isArray(value) ? (value as RagSource[]) : [];
}

function asCompliance(value: unknown): ComplianceResult | null {
  if (!value || typeof value !== "object") return null;
  return value as ComplianceResult;
}

export function mapMessage(row: MessageRow): RegulationChatMessage {
  return {
    id: row.id,
    chat_id: row.chat_id,
    role: asRole(row.role),
    content: row.content || "",
    kind: asKind(row.kind),
    sources: asSources(row.sources),
    compliance: asCompliance(row.compliance),
    filename: row.filename,
    error: Boolean(row.error),
    created_at: row.created_at,
  };
}

export function historyFromMessages(messages: RegulationChatMessage[]): AskHistoryTurn[] {
  return messages
    .filter((m) => !m.error && m.content.trim())
    .slice(-8)
    .map((m) => ({
      role: m.role,
      content: m.kind === "compliance" ? m.content.slice(0, 1200) : m.content.slice(0, 4000),
    }));
}
