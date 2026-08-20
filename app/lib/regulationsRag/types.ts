export type AuthorityId =
  | "cidco"
  | "midc"
  | "sra"
  | "mcgm"
  | "udcpr"
  | "stamp_duty"
  | "unknown";

export type Authority = {
  id: Exclude<AuthorityId, "unknown">;
  label: string;
  description: string;
};

export type RegulationMeta = {
  authority: AuthorityId;
  docType: string;
  areas: string[];
  title: string;
};

export type RegulationLookup = RegulationMeta & { source: string };

export type AuthorityDocument = {
  filename: string;
  title: string;
  docType: string;
};

export type AuthorityWithDocuments = Authority & {
  documents: AuthorityDocument[];
};

export type RagSource = {
  source: string;
  page: number | null;
  authority: string | null;
  score: number;
  snippet: string;
  docType?: string | null;
};

export type SearchHit = {
  id: string;
  text: string;
  source: string;
  page: number | null;
  authority: string | null;
  docType: string | null;
  title: string | null;
  score: number | undefined;
};

export type PdfChunk = {
  text: string;
  source: string;
  page: number;
  authority?: string;
  docType?: string;
  areas?: string[];
  title?: string;
};

export type StoreRecord = PdfChunk & {
  embedding: number[];
};

export type ChecklistStatus = "met" | "gap" | "unclear";

export type RegulationCite = {
  source?: string;
  page?: number | null;
};

export type ChecklistItem = {
  id?: string;
  requirement?: string;
  status?: ChecklistStatus | string;
  evidence_from_proposal?: string;
  regulation_cite?: RegulationCite;
  notes?: string;
};

export type ComplianceGap = {
  id?: string;
  title?: string;
  severity?: "high" | "medium" | "low" | string;
  detail?: string;
  regulation_cite?: RegulationCite;
};

export type JurisdictionDetection = {
  detected: string[];
  confidence: string;
  rationale: string;
  keywordHits: { authority: string; score: number }[];
};

export type AskResult = {
  answer: string;
  authorities: string[];
  sources: RagSource[];
};

export type ChatRole = "user" | "assistant";

export type ChatMessageKind = "text" | "ask" | "compliance" | "document";

export type RegulationChatSummary = {
  id: string;
  project_id: string;
  title: string;
  authorities: string[];
  document_filename: string | null;
  document_pages: number | null;
  created_at: string;
  updated_at: string;
};

export type ChatMessageReaction = "like" | "unlike";

export type RegulationChatMessage = {
  id: string;
  chat_id: string;
  role: ChatRole;
  content: string;
  kind: ChatMessageKind;
  sources: RagSource[];
  compliance: ComplianceResult | null;
  filename: string | null;
  error: boolean;
  reaction: ChatMessageReaction | null;
  created_at: string;
};

export type AskHistoryTurn = {
  role: ChatRole;
  content: string;
};

export type ComplianceResult = {
  needsAuthoritySelection: boolean;
  detection: JurisdictionDetection;
  authorities: string[];
  authoritySource?: string;
  authorityLabels?: string;
  summary: string;
  checklist: ChecklistItem[];
  gaps: ComplianceGap[];
  sources: RagSource[];
  proposal: {
    filename: string;
    pages: number;
    chars: number;
  };
};

export type HealthResult = {
  ok: boolean;
  llmProvider: string;
  model: string;
  embedModel: string;
  baseURL: string;
  docsDir: string;
  vectorDb: "pinecone";
  pineconeIndex: string;
  pineconeConfigured: boolean;
};
