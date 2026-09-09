"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CircleDashed,
  Eye,
  FileText,
  Folder,
  Library,
  Loader2,
} from "lucide-react";
import CustomSelect from "@/app/components/CustomSelect";
import DocumentPreviewModal from "@/app/components/DocumentPreviewModal";
import { useDashboardProjects } from "@/app/hooks/useDashboardProjects";
import { supabase } from "@/app/utils/supabase";
import {
  PROJECT_LIBRARY_DOCUMENT_NAMES,
  classifyProjectLibraryStoragePath,
  projectLibraryExtraStoragePath,
  type ProjectLibraryExtraDocType,
} from "@/app/utils/projectSections";
import { getProjectLabel } from "@/app/userdashboard/administrationApplicants";
import { fetchProjectForEdit } from "@/app/utils/fetchProjectForEdit";

type FolderSection =
  | "pr-card"
  | "dp-remarks"
  | "crz-remarks"
  | "power-of-attorney"
  | "assessment-department"
  | "airport-authority-of-india"
  | "other";

type LibraryUpload = {
  name?: string;
  path?: string;
  url?: string;
  uploadedAt?: string;
  expiryDate?: string;
};

type LibraryRow = {
  id: string;
  projectId: string;
  projectLabel: string;
  authority: string;
  fileName: string;
  folder: FolderSection;
  folderLabel: string;
  path: string;
  url: string;
  uploadedAt: string | null;
};

type FolderSummary = {
  folder: FolderSection;
  label: string;
  documentCount: number;
  projectCount: number;
};

const FOLDER_LABELS: Record<FolderSection, string> = {
  "pr-card": PROJECT_LIBRARY_DOCUMENT_NAMES[0],
  "dp-remarks": PROJECT_LIBRARY_DOCUMENT_NAMES[1],
  "crz-remarks": PROJECT_LIBRARY_DOCUMENT_NAMES[2],
  "power-of-attorney": PROJECT_LIBRARY_DOCUMENT_NAMES[3],
  "assessment-department": PROJECT_LIBRARY_DOCUMENT_NAMES[4],
  "airport-authority-of-india": PROJECT_LIBRARY_DOCUMENT_NAMES[5],
  other: "Other",
};

const FOLDER_ORDER: FolderSection[] = [
  "pr-card",
  "dp-remarks",
  "crz-remarks",
  "power-of-attorney",
  "assessment-department",
  "airport-authority-of-india",
  "other",
];

function folderSectionFromPath(path: string): FolderSection {
  const kind = classifyProjectLibraryStoragePath(path);
  if (!kind) return "other";
  if (kind.role === "fixed") {
    if (kind.slot === 0) return "pr-card";
    if (kind.slot === 1) return "dp-remarks";
    if (kind.slot === 2) return "crz-remarks";
    if (kind.slot === 3) return "power-of-attorney";
    if (kind.slot === 4) return "assessment-department";
    if (kind.slot === 5) return "airport-authority-of-india";
    return "other";
  }
  if (kind.type === "pr-card") return "pr-card";
  if (
    kind.type === "dp-remarks" ||
    kind.type === "dp-remarks-map" ||
    kind.type === "dp-remarks-rl"
  ) {
    return "dp-remarks";
  }
  if (kind.type === "crz-remarks") return "crz-remarks";
  if (kind.type === "power-of-attorney") return "power-of-attorney";
  if (kind.type === "assessment-department") return "assessment-department";
  if (kind.type === "airport-authority-of-india") return "airport-authority-of-india";
  return "other";
}

function getPlanningAuthority(savePlotDetails: unknown): string {
  const plot = savePlotDetails as { planningAuthority?: string } | null | undefined;
  return plot?.planningAuthority?.trim().toUpperCase() || "—";
}

function publicUrlForPath(path: string): string {
  if (!path) return "";
  const { data } = supabase.storage.from("project-library").getPublicUrl(path);
  return data?.publicUrl || "";
}

function parseLibraryUploads(library: unknown): LibraryUpload[] {
  if (Array.isArray(library)) return library as LibraryUpload[];
  if (!library || typeof library !== "object") return [];
  const uploads = (library as { uploads?: unknown }).uploads;
  return Array.isArray(uploads) ? (uploads as LibraryUpload[]) : [];
}

function resolveUploadUrl(upload: LibraryUpload): string {
  const stored = upload.url?.trim() || "";
  if (stored && !stored.startsWith("blob:")) return stored;
  return publicUrlForPath(upload.path?.trim() || "");
}

type LibraryProjectRecord = {
  id: string;
  title: string;
  project_info?: unknown;
  save_plot_details?: unknown;
  project_library?: unknown;
};

async function loadLibraryProjectRecords(
  projects: { id: string }[]
): Promise<LibraryProjectRecord[]> {
  const projectIds = projects.map((p) => p.id);
  const { data, error } = await supabase
    .from("projects")
    .select("id, title, project_info, save_plot_details, project_library")
    .in("id", projectIds);

  if (!error && Array.isArray(data) && data.length === projectIds.length) {
    return data as LibraryProjectRecord[];
  }

  const fetched = await Promise.all(
    projectIds.map(async (id) => {
      const { project } = await fetchProjectForEdit(id);
      if (!project?.id) return null;
      const record: LibraryProjectRecord = {
        id: String(project.id),
        title: typeof project.title === "string" ? project.title : "",
        project_info: project.project_info,
        save_plot_details: project.save_plot_details,
        project_library: project.project_library,
      };
      return record;
    })
  );

  const records: LibraryProjectRecord[] = [];
  for (const row of fetched) {
    if (row) records.push(row);
  }
  return records;
}

function formatUploadedAt(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Map a draft/library path to the ProjectLibraryExtraDocType used for storage stems. */
function extraTypeFromLibraryPath(path: string): ProjectLibraryExtraDocType | null {
  const p = path.replace(/\\/g, "/").toLowerCase();
  if (p.includes("pr-card/extra-")) return "pr-card";
  if (p.includes("dp-remarks/extra-letter-") || p.includes("dp-remarks/extra-")) {
    return "dp-remarks";
  }
  if (p.includes("dp-remarks/map-")) return "dp-remarks-map";
  if (p.includes("dp-remarks/road-line-")) return "dp-remarks-rl";
  if (p.includes("crz-remarks/extra-")) return "crz-remarks";
  if (p.includes("power-of-attorney/extra-")) return "power-of-attorney";
  if (p.includes("assessment-department/extra-")) return "assessment-department";
  if (p.includes("airport-authority-of-india/extra-")) {
    return "airport-authority-of-india";
  }
  return null;
}

/**
 * Draft metadata often stores UUID stems (extra-11092047.pdf) while storage
 * upload uses sequential stems (extra-1.pdf). Build both candidates.
 */
function storagePathCandidates(
  row: LibraryRow,
  projectRows: LibraryRow[]
): string[] {
  const raw = row.path.trim().replace(/^\/+/, "");
  if (!raw) return [];

  const candidates: string[] = [];
  const push = (path: string) => {
    if (path && !candidates.includes(path)) candidates.push(path);
  };

  if (raw.includes("project-library/")) {
    push(raw);
  } else {
    push(`${row.projectId}/project-library/${raw}`);
  }

  const extraType = extraTypeFromLibraryPath(raw);
  if (extraType) {
    const siblings = projectRows.filter(
      (r) =>
        r.projectId === row.projectId &&
        extraTypeFromLibraryPath(r.path) === extraType
    );
    const index = siblings.findIndex((r) => r.id === row.id);
    if (index >= 0) {
      push(
        projectLibraryExtraStoragePath(
          row.projectId,
          extraType,
          index + 1,
          "pdf"
        )
      );
    }
  }

  return candidates;
}

async function tryDownloadBlob(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("project-library")
    .download(storagePath);
  if (!error && data) return URL.createObjectURL(data);

  const signed = await supabase.storage
    .from("project-library")
    .createSignedUrl(storagePath, 60 * 10);
  if (signed.error || !signed.data?.signedUrl) return null;
  try {
    const res = await fetch(signed.data.signedUrl);
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  } catch {
    return null;
  }
}

async function resolvePreviewBlobUrl(
  row: LibraryRow,
  projectRows: LibraryRow[]
): Promise<string | null> {
  for (const storagePath of storagePathCandidates(row, projectRows)) {
    const blobUrl = await tryDownloadBlob(storagePath);
    if (blobUrl) return blobUrl;
  }

  // Last resort: list the document folder and try sequential extras / primary.
  const raw = row.path.trim().replace(/^\/+/, "");
  const folderMatch = raw.match(
    /^(pr-card|dp-remarks|crz-remarks|power-of-attorney|assessment-department|airport-authority-of-india)\//i
  );
  if (folderMatch) {
    const folderPrefix = `${row.projectId}/project-library/${folderMatch[1]}`;
    const listed = await supabase.storage
      .from("project-library")
      .list(`${row.projectId}/project-library/${folderMatch[1]}`, {
        limit: 100,
      });
    if (!listed.error && Array.isArray(listed.data)) {
      const extraType = extraTypeFromLibraryPath(raw);
      if (extraType) {
        const siblings = projectRows.filter(
          (r) =>
            r.projectId === row.projectId &&
            extraTypeFromLibraryPath(r.path) === extraType
        );
        const index = siblings.findIndex((r) => r.id === row.id);
        const stemPrefix =
          extraType === "dp-remarks-map"
            ? "map-"
            : extraType === "dp-remarks-rl"
              ? "road-line-"
              : extraType === "dp-remarks"
                ? "extra-letter-"
                : "extra-";
        const match = listed.data.find(
          (f) =>
            f.name?.toLowerCase() === `${stemPrefix}${index + 1}.pdf` ||
            f.name?.toLowerCase() === raw.split("/").pop()?.toLowerCase()
        );
        if (match?.name) {
          const blobUrl = await tryDownloadBlob(`${folderPrefix}/${match.name}`);
          if (blobUrl) return blobUrl;
        }
      } else {
        const fileName = raw.split("/").pop();
        const match = listed.data.find(
          (f) => f.name?.toLowerCase() === fileName?.toLowerCase()
        );
        if (match?.name) {
          const blobUrl = await tryDownloadBlob(`${folderPrefix}/${match.name}`);
          if (blobUrl) return blobUrl;
        }
      }
    }
  }

  const directUrl = row.url?.trim() || "";
  if (!directUrl || directUrl.startsWith("blob:")) return null;

  try {
    const res = await fetch(directUrl);
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  } catch {
    return null;
  }
}

export default function ProjectLibraryBrowserPage() {
  const { projects, loading: projectsLoading } = useDashboardProjects();
  const [projectRecords, setProjectRecords] = useState<LibraryProjectRecord[]>(
    []
  );
  const [rows, setRows] = useState<LibraryRow[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [authorityFilter, setAuthorityFilter] = useState("ALL");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [selectedFolder, setSelectedFolder] = useState<FolderSection | null>(
    null
  );
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(
    null
  );
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewBlobRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (projectsLoading) return;
      if (projects.length === 0) {
        if (!cancelled) {
          setProjectRecords([]);
          setRows([]);
          setFilesLoading(false);
        }
        return;
      }

      setFilesLoading(true);
      const records = await loadLibraryProjectRecords(projects);
      if (cancelled) return;

      const nextRows: LibraryRow[] = [];
      for (const project of records) {
        const projectLabel = getProjectLabel({
          title: project.title,
          project_info: project.project_info as {
            proposalNo?: string;
            title?: string;
          } | null,
        });
        const authority = getPlanningAuthority(project.save_plot_details);
        const uploads = parseLibraryUploads(project.project_library);

        uploads.forEach((upload, index) => {
          const path = upload.path?.trim() || "";
          const url = resolveUploadUrl(upload);
          if (!path && !upload.name) return;
          const folder = folderSectionFromPath(path || upload.name || "");
          nextRows.push({
            id: `${project.id}-${path || upload.name || index}`,
            projectId: project.id,
            projectLabel,
            authority,
            fileName: upload.name?.trim() || path.split("/").pop() || "Document",
            folder,
            folderLabel: FOLDER_LABELS[folder],
            path,
            url,
            uploadedAt: upload.uploadedAt?.trim() || null,
          });
        });
      }

      setProjectRecords(records);
      setRows(nextRows);
      setFilesLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [projects, projectsLoading]);

  const authorityOptions = useMemo(() => {
    const set = new Set<string>();
    for (const project of projectRecords) {
      const authority = getPlanningAuthority(project.save_plot_details);
      if (authority && authority !== "—") set.add(authority);
    }
    return [...set].sort();
  }, [projectRecords]);

  const projectsForAuthority = useMemo(() => {
    return projectRecords
      .filter((project) => {
        if (authorityFilter === "ALL") return true;
        return getPlanningAuthority(project.save_plot_details) === authorityFilter;
      })
      .map((project) => ({
        id: project.id,
        label: getProjectLabel({
          title: project.title,
          project_info: project.project_info as {
            proposalNo?: string;
            title?: string;
          } | null,
        }),
      }));
  }, [projectRecords, authorityFilter]);

  useEffect(() => {
    if (projectFilter === "ALL") return;
    if (!projectsForAuthority.some((p) => p.id === projectFilter)) {
      setProjectFilter("ALL");
    }
  }, [projectFilter, projectsForAuthority]);

  // Stay inside the current folder when filters change; if that folder has no
  // matching docs, show the in-folder empty state (do not bounce to folder list).
  useEffect(() => {
    if (!selectedFolder) return;
    const stillExists = rows.some((row) => row.folder === selectedFolder);
    if (!stillExists) setSelectedFolder(null);
  }, [rows, selectedFolder]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (authorityFilter !== "ALL" && row.authority !== authorityFilter) {
        return false;
      }
      if (projectFilter !== "ALL" && row.projectId !== projectFilter) {
        return false;
      }
      return true;
    });
  }, [rows, authorityFilter, projectFilter]);

  const folderSummaries = useMemo((): FolderSummary[] => {
    const byFolder = new Map<
      FolderSection,
      { documentCount: number; projectIds: Set<string> }
    >();

    for (const row of filtered) {
      const entry = byFolder.get(row.folder) ?? {
        documentCount: 0,
        projectIds: new Set<string>(),
      };
      entry.documentCount += 1;
      entry.projectIds.add(row.projectId);
      byFolder.set(row.folder, entry);
    }

    return FOLDER_ORDER.flatMap((folder) => {
      const entry = byFolder.get(folder);
      if (!entry || entry.documentCount === 0) return [];
      return [
        {
          folder,
          label: FOLDER_LABELS[folder],
          documentCount: entry.documentCount,
          projectCount: entry.projectIds.size,
        },
      ];
    });
  }, [filtered]);

  const folderDocuments = useMemo(() => {
    if (!selectedFolder) return [];
    return filtered.filter((row) => row.folder === selectedFolder);
  }, [filtered, selectedFolder]);

  const loading = projectsLoading || filesLoading;

  const closePreview = () => {
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(false);
    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current);
      previewBlobRef.current = null;
    }
  };

  const openPreview = async (row: LibraryRow) => {
    setPreviewError(null);
    setPreviewLoading(true);
    // Keep modal open with title only while resolving storage → blob URL.
    setPreview({ url: "", title: row.fileName });

    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current);
      previewBlobRef.current = null;
    }

    try {
      const projectRows = rows.filter((r) => r.projectId === row.projectId);
      const blobUrl = await resolvePreviewBlobUrl(row, projectRows);
      if (!blobUrl) {
        setPreview({ url: "", title: row.fileName });
        setPreviewError("Could not load the saved PDF.");
        return;
      }
      previewBlobRef.current = blobUrl;
      setPreviewError(null);
      setPreview({ url: blobUrl, title: row.fileName });
    } catch {
      setPreview({ url: "", title: row.fileName });
      setPreviewError("Could not load the saved PDF.");
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-4 overflow-hidden px-4 py-4 md:px-6 md:py-6">
      <DocumentPreviewModal
        open={Boolean(preview) || previewLoading || Boolean(previewError)}
        onClose={closePreview}
        fileUrl={preview?.url || null}
        title={preview?.title || "Document Preview"}
        hideSaveButton
        isLoading={previewLoading}
        loadError={previewError}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex shrink-0 flex-col gap-4 border-b border-gray-100 px-5 py-4 md:px-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-brand-navy md:text-2xl">
              Project Library
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Uploaded library documents across your projects
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                Authority
              </label>
              <CustomSelect
                value={authorityFilter}
                onChange={setAuthorityFilter}
                options={[
                  { value: "ALL", label: "All authorities" },
                  ...authorityOptions.map((authority) => ({
                    value: authority,
                    label: authority,
                  })),
                ]}
                placeholder={loading ? "Loading…" : "All authorities"}
                disabled={loading}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                Project
              </label>
              <CustomSelect
                value={projectFilter}
                onChange={setProjectFilter}
                options={[
                  { value: "ALL", label: "All projects" },
                  ...projectsForAuthority.map((project) => ({
                    value: project.id,
                    label: project.label,
                  })),
                ]}
                placeholder={loading ? "Loading…" : "All projects"}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin text-brand-blue" />
              Loading documents…
            </div>
          ) : selectedFolder ? (
            <>
              <div className="flex items-center gap-2 border-b border-gray-50 px-5 py-3 md:px-6">
                <button
                  type="button"
                  onClick={() => setSelectedFolder(null)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-brand-blue hover:bg-brand-blue/5"
                >
                  <ArrowLeft className="h-4 w-4" />
                  All folders
                </button>
                <span className="text-gray-300">/</span>
                <span className="truncate text-sm font-medium text-brand-navy">
                  {FOLDER_LABELS[selectedFolder]}
                </span>
              </div>
              {folderDocuments.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
                  <CircleDashed className="h-8 w-8 text-gray-300" />
                  <p className="text-sm text-gray-500">
                    No documents in this folder for the selected filters.
                  </p>
                </div>
              ) : (
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      <th className="px-5 py-3 font-semibold md:px-6">Document</th>
                      <th className="px-3 py-3 font-semibold">Project</th>
                      <th className="px-3 py-3 font-semibold">Authority</th>
                      <th className="px-3 py-3 font-semibold">Date</th>
                      <th className="px-3 py-3 pr-5 font-semibold md:pr-6">
                        Preview
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {folderDocuments.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-gray-50 last:border-0"
                      >
                        <td className="px-5 py-3 md:px-6">
                          <button
                            type="button"
                            onClick={() => void openPreview(row)}
                            disabled={!row.url && !row.path}
                            className="flex max-w-full items-center gap-2 text-left text-brand-navy hover:text-brand-blue disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:text-gray-400"
                          >
                            <FileText className="h-4 w-4 shrink-0 text-brand-blue" />
                            <span className="truncate font-medium">
                              {row.fileName}
                            </span>
                          </button>
                        </td>
                        <td className="px-3 py-3 text-gray-600">
                          {row.projectLabel}
                        </td>
                        <td className="px-3 py-3 text-gray-600">
                          {row.authority}
                        </td>
                        <td className="px-3 py-3 text-gray-500">
                          {formatUploadedAt(row.uploadedAt)}
                        </td>
                        <td className="px-3 py-3 pr-5 md:pr-6">
                          <button
                            type="button"
                            onClick={() => void openPreview(row)}
                            disabled={!row.url && !row.path}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-brand-blue hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-400 disabled:hover:bg-white"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Preview
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
              {rows.length === 0 ? (
                <Library className="h-8 w-8 text-gray-300" />
              ) : (
                <CircleDashed className="h-8 w-8 text-gray-300" />
              )}
              <p className="text-sm text-gray-500">
                {rows.length === 0
                  ? "No library documents uploaded yet."
                  : "No documents match these filters."}
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-5 py-3 font-semibold md:px-6">Folder</th>
                  <th className="px-3 py-3 font-semibold">Documents</th>
                  <th className="px-3 py-3 pr-5 font-semibold md:pr-6">
                    Projects
                  </th>
                </tr>
              </thead>
              <tbody>
                {folderSummaries.map((summary) => (
                  <tr
                    key={summary.folder}
                    className="border-b border-gray-50 last:border-0"
                  >
                    <td className="px-5 py-3 md:px-6">
                      <button
                        type="button"
                        onClick={() => setSelectedFolder(summary.folder)}
                        className="flex max-w-full items-center gap-2 text-left text-brand-navy hover:text-brand-blue"
                      >
                        <Folder className="h-4 w-4 shrink-0 text-brand-blue" />
                        <span className="truncate font-medium">
                          {summary.label}
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-3 text-gray-600">
                      {summary.documentCount}
                    </td>
                    <td className="px-3 py-3 pr-5 text-gray-600 md:pr-6">
                      {summary.projectCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
