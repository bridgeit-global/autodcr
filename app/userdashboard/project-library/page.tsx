"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleDashed, FileText, Library, Loader2 } from "lucide-react";
import CustomSelect from "@/app/components/CustomSelect";
import DocumentPreviewModal from "@/app/components/DocumentPreviewModal";
import { useDashboardProjects } from "@/app/hooks/useDashboardProjects";
import { supabase } from "@/app/utils/supabase";
import {
  PROJECT_LIBRARY_DOCUMENT_NAMES,
  classifyProjectLibraryStoragePath,
} from "@/app/utils/projectSections";
import { getProjectLabel } from "@/app/userdashboard/administrationApplicants";
import { fetchProjectForEdit } from "@/app/utils/fetchProjectForEdit";

type FolderSection =
  | "pr-card"
  | "dp-remarks"
  | "crz-remarks"
  | "power-of-attorney"
  | "other";

type LibraryUpload = {
  name?: string;
  path?: string;
  url?: string;
  uploadedAt?: string;
};

type LibraryRow = {
  id: string;
  projectId: string;
  projectLabel: string;
  authority: string;
  fileName: string;
  folder: FolderSection;
  folderLabel: string;
  url: string;
  uploadedAt: string | null;
};

const FOLDER_LABELS: Record<FolderSection, string> = {
  "pr-card": PROJECT_LIBRARY_DOCUMENT_NAMES[0],
  "dp-remarks": PROJECT_LIBRARY_DOCUMENT_NAMES[1],
  "crz-remarks": PROJECT_LIBRARY_DOCUMENT_NAMES[2],
  "power-of-attorney": PROJECT_LIBRARY_DOCUMENT_NAMES[3],
  other: "Other",
};

const FOLDER_FILTERS: FolderSection[] = [
  "pr-card",
  "dp-remarks",
  "crz-remarks",
  "power-of-attorney",
];

function folderSectionFromPath(path: string): FolderSection {
  const kind = classifyProjectLibraryStoragePath(path);
  if (!kind) return "other";
  if (kind.role === "fixed") {
    if (kind.slot === 0) return "pr-card";
    if (kind.slot === 1) return "dp-remarks";
    if (kind.slot === 2) return "crz-remarks";
    if (kind.slot === 3) return "power-of-attorney";
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

export default function ProjectLibraryBrowserPage() {
  const { projects, loading: projectsLoading } = useDashboardProjects();
  const [projectRecords, setProjectRecords] = useState<LibraryProjectRecord[]>(
    []
  );
  const [rows, setRows] = useState<LibraryRow[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [authorityFilter, setAuthorityFilter] = useState("ALL");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [folderFilter, setFolderFilter] = useState("ALL");
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(
    null
  );

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

  const hasOtherFiles = rows.some((row) => row.folder === "other");

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (authorityFilter !== "ALL" && row.authority !== authorityFilter) {
        return false;
      }
      if (projectFilter !== "ALL" && row.projectId !== projectFilter) {
        return false;
      }
      if (folderFilter !== "ALL" && row.folder !== folderFilter) {
        return false;
      }
      return true;
    });
  }, [rows, authorityFilter, projectFilter, folderFilter]);

  const loading = projectsLoading || filesLoading;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-4 overflow-hidden px-4 py-4 md:px-6 md:py-6">
      <DocumentPreviewModal
        open={Boolean(preview?.url)}
        onClose={() => setPreview(null)}
        fileUrl={preview?.url}
        title={preview?.title}
        hideSaveButton
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
          <div className="grid gap-3 sm:grid-cols-3">
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
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                Folder
              </label>
              <CustomSelect
                value={folderFilter}
                onChange={setFolderFilter}
                options={[
                  { value: "ALL", label: "All folders" },
                  ...FOLDER_FILTERS.map((folder) => ({
                    value: folder,
                    label: FOLDER_LABELS[folder],
                  })),
                  ...(hasOtherFiles
                    ? [{ value: "other" as const, label: FOLDER_LABELS.other }]
                    : []),
                ]}
                placeholder="All folders"
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
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-5 py-3 font-semibold md:px-6">Document</th>
                  <th className="px-3 py-3 font-semibold">Folder</th>
                  <th className="px-3 py-3 font-semibold">Project</th>
                  <th className="px-3 py-3 font-semibold">Authority</th>
                  <th className="px-3 py-3 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-50 last:border-0"
                  >
                    <td className="px-5 py-3 md:px-6">
                      <button
                        type="button"
                        onClick={() => {
                          if (!row.url) return;
                          setPreview({ url: row.url, title: row.fileName });
                        }}
                        className="flex max-w-full items-center gap-2 text-left text-brand-navy hover:text-brand-blue"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-brand-blue" />
                        <span className="truncate font-medium">{row.fileName}</span>
                      </button>
                    </td>
                    <td className="px-3 py-3 text-gray-600">{row.folderLabel}</td>
                    <td className="px-3 py-3 text-gray-600">{row.projectLabel}</td>
                    <td className="px-3 py-3 text-gray-600">{row.authority}</td>
                    <td className="px-3 py-3 text-gray-500">
                      {formatUploadedAt(row.uploadedAt)}
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
