import { supabase } from "@/app/utils/supabase";

export type ApplicationDocumentDraftStatus = "draft" | "saved";

export type ApplicationDocumentDraft = {
  applicationId: string;
  catalogDocumentId: string;
  fieldValues: Record<string, string>;
  status: ApplicationDocumentDraftStatus;
  pdfPath: string | null;
  updatedAt: string;
};

export type SavedApplicationDocumentListItem = {
  pdfPath: string;
  updatedAt: string;
  projectId: string;
  projectTitle: string;
  permissionType: string;
  documentSlug: string;
  documentCategory: string;
  typeSlug: string;
  typeTitle: string;
};

function fieldValuesFromUnknown(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string") next[key] = value;
  }
  return next;
}

function asStatus(value: unknown): ApplicationDocumentDraftStatus {
  return value === "saved" ? "saved" : "draft";
}

export async function fetchApplicationDocumentDrafts(
  applicationId: string
): Promise<ApplicationDocumentDraft[]> {
  const { data, error } = await supabase
    .from("application_document_drafts")
    .select("application_id, catalog_document_id, field_values, status, pdf_path, updated_at")
    .eq("application_id", applicationId);

  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) return [];

  return data.map((row) => {
    const record = row as Record<string, unknown>;
    return {
      applicationId: String(record.application_id ?? ""),
      catalogDocumentId: String(record.catalog_document_id ?? ""),
      fieldValues: fieldValuesFromUnknown(record.field_values),
      status: asStatus(record.status),
      pdfPath: typeof record.pdf_path === "string" && record.pdf_path.trim() ? record.pdf_path : null,
      updatedAt: typeof record.updated_at === "string" ? record.updated_at : "",
    };
  });
}

export async function upsertApplicationDocumentDraft(input: {
  applicationId: string;
  catalogDocumentId: string;
  fieldValues: Record<string, string>;
  status: ApplicationDocumentDraftStatus;
  pdfPath: string | null;
}): Promise<void> {
  const { error } = await supabase.from("application_document_drafts").upsert(
    {
      application_id: input.applicationId,
      catalog_document_id: input.catalogDocumentId,
      field_values: input.fieldValues,
      status: input.status,
      pdf_path: input.pdfPath,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "application_id,catalog_document_id" }
  );
  if (error) throw new Error(error.message);
}

type NestedRecord = Record<string, unknown>;

function firstRecord(value: unknown): NestedRecord | null {
  if (Array.isArray(value)) {
    const row = value[0];
    return row && typeof row === "object" ? (row as NestedRecord) : null;
  }
  if (value && typeof value === "object") return value as NestedRecord;
  return null;
}

/** Saved documents across projects the caller can read. One query. */
export async function fetchSavedApplicationDocuments(): Promise<SavedApplicationDocumentListItem[]> {
  const { data, error } = await supabase
    .from("application_document_drafts")
    .select(
      "pdf_path, updated_at, status, applications!inner(project_id, project_title, permission_type), application_documents!inner(slug, category, application_types!inner(slug, application_title))"
    )
    .eq("status", "saved");

  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) return [];

  const items: SavedApplicationDocumentListItem[] = [];
  for (const row of data) {
    const record = row as NestedRecord;
    const pdfPath = typeof record.pdf_path === "string" ? record.pdf_path.trim() : "";
    if (!pdfPath) continue;
    const application = firstRecord(record.applications);
    const document = firstRecord(record.application_documents);
    const applicationType = document ? firstRecord(document.application_types) : null;
    const projectId = typeof application?.project_id === "string" ? application.project_id : "";
    const typeSlug = typeof applicationType?.slug === "string" ? applicationType.slug.trim() : "";
    const documentSlug = typeof document?.slug === "string" ? document.slug.trim() : "";
    if (!projectId || !typeSlug || !documentSlug) continue;
    items.push({
      pdfPath,
      updatedAt: typeof record.updated_at === "string" ? record.updated_at : "",
      projectId,
      projectTitle: typeof application?.project_title === "string" ? application.project_title : "",
      permissionType:
        typeof application?.permission_type === "string" ? application.permission_type : "",
      documentSlug,
      documentCategory: typeof document?.category === "string" ? document.category : documentSlug,
      typeSlug,
      typeTitle:
        typeof applicationType?.application_title === "string" && applicationType.application_title.trim()
          ? applicationType.application_title.trim()
          : typeSlug,
    });
  }
  return items;
}
