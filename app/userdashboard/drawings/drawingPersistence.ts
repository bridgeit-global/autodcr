import { supabase } from "@/app/utils/supabase";
import type {
  DrawingRemark,
  DrawingRemarkKind,
  DrawingVersion,
  DrawingVersionStatus,
  KeyChange,
  KeyChangeTone,
  RedlineMark,
} from "@/app/userdashboard/drawings/drawingsData";

export const DRAWING_STORAGE_BUCKET = "project-library";

export type DrawingReviewSnapshot = {
  versions: DrawingVersion[];
  remarks: DrawingRemark[];
  redlinesByVersionId: Record<string, RedlineMark[]>;
};

function formatDateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function isVersionStatus(value: string): value is DrawingVersionStatus {
  return (
    value === "current" ||
    value === "previous" ||
    value === "approved" ||
    value === "revision_requested"
  );
}

function isRemarkKind(value: string): value is DrawingRemarkKind {
  return value === "comment" || value === "revision_request" || value === "approval";
}

function isKeyChangeTone(value: string): value is KeyChangeTone {
  return value === "up" || value === "down" || value === "ok" || value === "note";
}

function parseKeyChanges(raw: unknown): KeyChange[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { id?: unknown; label?: unknown; tone?: unknown };
    const label = typeof row.label === "string" ? row.label : "";
    if (!label) return [];
    const tone = typeof row.tone === "string" && isKeyChangeTone(row.tone) ? row.tone : "note";
    return [
      {
        id: typeof row.id === "string" && row.id ? row.id : `kc-${index}`,
        label,
        tone,
      },
    ];
  });
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "drawing.dwg";
}

function mapVersion(row: {
  id: string;
  file_name: string;
  storage_path: string;
  status: string;
  key_changes: unknown;
  created_at: string;
}): DrawingVersion {
  return {
    id: row.id,
    name: row.file_name.replace(/\.(dwg|dxf)$/i, ""),
    fileName: row.file_name,
    storagePath: row.storage_path,
    dateLabel: formatDateLabel(row.created_at),
    status: isVersionStatus(row.status) ? row.status : "previous",
    keyChanges: parseKeyChanges(row.key_changes),
  };
}

function mapRemark(row: {
  id: string;
  drawing_version_id: string;
  author_name: string;
  author_role: string;
  body: string;
  kind: string;
  created_at: string;
}): DrawingRemark {
  const role = row.author_role || row.author_name || "Reviewer";
  return {
    id: row.id,
    versionId: row.drawing_version_id,
    author: row.author_name || role,
    role,
    initials: initialsFromName(row.author_name || role),
    dateLabel: formatDateLabel(row.created_at),
    body: row.body,
    kind: isRemarkKind(row.kind) ? row.kind : "comment",
  };
}

function mapRedline(row: {
  id: string;
  kind: string;
  geometry: unknown;
  color: string | null;
  label: string | null;
}): RedlineMark | null {
  if (row.kind !== "rect" && row.kind !== "pin") return null;
  const geometry =
    row.geometry && typeof row.geometry === "object" ? (row.geometry as Record<string, unknown>) : {};
  const x = typeof geometry.x === "number" ? geometry.x : Number(geometry.x);
  const y = typeof geometry.y === "number" ? geometry.y : Number(geometry.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const w = typeof geometry.w === "number" ? geometry.w : Number(geometry.w);
  const h = typeof geometry.h === "number" ? geometry.h : Number(geometry.h);
  return {
    id: row.id,
    kind: row.kind,
    x,
    y,
    w: Number.isFinite(w) ? w : undefined,
    h: Number.isFinite(h) ? h : undefined,
    color: row.color || "#dc2626",
    label: row.label || undefined,
  };
}

export async function listDrawingReview(projectId: string): Promise<DrawingReviewSnapshot> {
  const { data: versionRows, error: versionError } = await supabase
    .from("drawing_versions")
    .select("id, file_name, storage_path, status, key_changes, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (versionError) throw new Error(versionError.message);

  const versions = (versionRows ?? []).map(mapVersion);
  const versionIds = versions.map((version) => version.id);
  if (versionIds.length === 0) {
    return { versions: [], remarks: [], redlinesByVersionId: {} };
  }

  const [{ data: remarkRows, error: remarkError }, { data: redlineRows, error: redlineError }] =
    await Promise.all([
      supabase
        .from("drawing_remarks")
        .select("id, drawing_version_id, author_name, author_role, body, kind, created_at")
        .in("drawing_version_id", versionIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("drawing_redlines")
        .select("id, drawing_version_id, kind, geometry, color, label")
        .in("drawing_version_id", versionIds)
        .order("created_at", { ascending: true }),
    ]);

  if (remarkError) throw new Error(remarkError.message);
  if (redlineError) throw new Error(redlineError.message);

  const redlinesByVersionId: Record<string, RedlineMark[]> = {};
  for (const row of redlineRows ?? []) {
    const mark = mapRedline(row);
    if (!mark) continue;
    const list = redlinesByVersionId[row.drawing_version_id] ?? [];
    list.push(mark);
    redlinesByVersionId[row.drawing_version_id] = list;
  }

  return {
    versions,
    remarks: (remarkRows ?? []).map(mapRemark),
    redlinesByVersionId,
  };
}

export async function uploadDrawingVersion(params: {
  projectId: string;
  file: File;
  userId: string;
}): Promise<DrawingVersion> {
  const versionId = crypto.randomUUID();
  const fileName = safeFileName(params.file.name);
  const storagePath = `${params.projectId}/drawings/${versionId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(DRAWING_STORAGE_BUCKET)
    .upload(storagePath, params.file, {
      upsert: true,
      contentType: params.file.type || "application/octet-stream",
    });
  if (uploadError) throw new Error(uploadError.message);

  const { error: demoteError } = await supabase
    .from("drawing_versions")
    .update({ status: "previous" })
    .eq("project_id", params.projectId)
    .eq("status", "current");
  if (demoteError) throw new Error(demoteError.message);

  const { data, error } = await supabase
    .from("drawing_versions")
    .insert({
      id: versionId,
      project_id: params.projectId,
      file_name: params.file.name,
      storage_path: storagePath,
      file_size_bytes: params.file.size,
      status: "current",
      uploaded_by: params.userId,
    })
    .select("id, file_name, storage_path, status, key_changes, created_at")
    .single();

  if (error || !data) throw new Error(error?.message || "Failed to save drawing version");
  return mapVersion(data);
}

export async function downloadDrawingBuffer(storagePath: string): Promise<ArrayBuffer> {
  const { data, error } = await supabase.storage.from(DRAWING_STORAGE_BUCKET).download(storagePath);
  if (error || !data) throw new Error(error?.message || "Failed to download drawing");
  return data.arrayBuffer();
}

export async function addDrawingRemark(params: {
  versionId: string;
  userId: string;
  authorName: string;
  authorRole: string;
  kind: DrawingRemarkKind;
  body: string;
}): Promise<DrawingRemark> {
  const { data, error } = await supabase
    .from("drawing_remarks")
    .insert({
      drawing_version_id: params.versionId,
      author_user_id: params.userId,
      author_name: params.authorName,
      author_role: params.authorRole,
      kind: params.kind,
      body: params.body,
    })
    .select("id, drawing_version_id, author_name, author_role, body, kind, created_at")
    .single();

  if (error || !data) throw new Error(error?.message || "Failed to save remark");
  return mapRemark(data);
}

export async function updateDrawingVersionStatus(
  versionId: string,
  status: DrawingVersionStatus
): Promise<void> {
  const { error } = await supabase.from("drawing_versions").update({ status }).eq("id", versionId);
  if (error) throw new Error(error.message);
}

export async function updateDrawingKeyChanges(versionId: string, keyChanges: KeyChange[]): Promise<void> {
  const { error } = await supabase
    .from("drawing_versions")
    .update({ key_changes: keyChanges })
    .eq("id", versionId);
  if (error) throw new Error(error.message);
}

export async function replaceDrawingRedlines(params: {
  versionId: string;
  userId: string;
  marks: RedlineMark[];
}): Promise<void> {
  const { error: deleteError } = await supabase
    .from("drawing_redlines")
    .delete()
    .eq("drawing_version_id", params.versionId);
  if (deleteError) throw new Error(deleteError.message);

  if (params.marks.length === 0) return;

  const { error } = await supabase.from("drawing_redlines").insert(
    params.marks.map((mark) => ({
      drawing_version_id: params.versionId,
      author_user_id: params.userId,
      kind: mark.kind,
      geometry: { x: mark.x, y: mark.y, w: mark.w, h: mark.h },
      color: mark.color,
      label: mark.label ?? null,
    }))
  );
  if (error) throw new Error(error.message);
}
