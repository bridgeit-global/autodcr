"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  CircleDashed,
  FileText,
  Folder,
  Loader2,
} from "lucide-react";
import { useMasterProjectFilter } from "@/app/components/appshell/MasterProjectFilterContext";
import DocumentPreviewModal from "@/app/components/DocumentPreviewModal";
import {
  readRememberedDashboardProjectIds,
  useDashboardProjects,
} from "@/app/hooks/useDashboardProjects";
import { supabase } from "@/app/utils/supabase";
import {
  PROJECT_LIBRARY_DOCUMENT_NAMES,
  classifyProjectLibraryStoragePath,
  projectLibraryExtraStoragePath,
  type ProjectLibraryExtraDocType,
} from "@/app/utils/projectSections";
import { getProjectLabel } from "@/app/userdashboard/administrationApplicants";
import {
  fetchApplicationsList,
  type DashboardApplication,
} from "@/app/userdashboard/applicationsList";
import {
  catalogDocumentOptionLabel,
  fetchApplicationCatalogTypes,
  fetchDocumentsForApplicationType,
  type ApplicationCatalogDocument,
  type ApplicationCatalogType,
} from "@/app/utils/applicationCatalog";
import { fetchSavedApplicationDocuments } from "@/app/utils/applicationDocumentDrafts";
import { fetchProjectForEdit } from "@/app/utils/fetchProjectForEdit";
import { isDocumentDraftStoragePath, readApplicationUrlFromUrls } from "@/app/utils/projectSavedApplicationPdfUrl";
import {
  generateApplicationPreviewHtml,
  mapApplicationPreviewFields,
  mapSelectedApplicationToTemplate,
  type ApplicationPreviewSource,
} from "@/app/templates/applicationPreview";

type FolderSection =
  | "pr-card"
  | "dp-remarks"
  | "crz-remarks"
  | "power-of-attorney"
  | "assessment-department"
  | "airport-authority-of-india"
  | "saved-applications"
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
  savedTypeSlug?: string;
  savedTypeTitle?: string;
  savedDocumentSlug?: string;
  savedDocumentTitle?: string;
};

type LibrarySection = "documents" | "applications";

type ProjectFolderSummary = {
  id: string;
  label: string;
  documentCount: number;
};

const FOLDER_LABELS: Record<FolderSection, string> = {
  "pr-card": PROJECT_LIBRARY_DOCUMENT_NAMES[0],
  "dp-remarks": PROJECT_LIBRARY_DOCUMENT_NAMES[1],
  "crz-remarks": PROJECT_LIBRARY_DOCUMENT_NAMES[2],
  "power-of-attorney": PROJECT_LIBRARY_DOCUMENT_NAMES[3],
  "assessment-department": PROJECT_LIBRARY_DOCUMENT_NAMES[4],
  "airport-authority-of-india": PROJECT_LIBRARY_DOCUMENT_NAMES[5],
  "saved-applications": "Saved Applications",
  other: "Other",
};

const FOLDER_ORDER: FolderSection[] = [
  "pr-card",
  "dp-remarks",
  "crz-remarks",
  "power-of-attorney",
  "assessment-department",
  "airport-authority-of-india",
  "saved-applications",
  "other",
];

function documentTypesForProject(rows: LibraryRow[], projectId: string) {
  const byFolder = new Map<FolderSection, number>();
  for (const row of rows) {
    if (row.projectId !== projectId || row.folder === "saved-applications") continue;
    byFolder.set(row.folder, (byFolder.get(row.folder) ?? 0) + 1);
  }
  return FOLDER_ORDER.flatMap((folder) => {
    if (folder === "saved-applications") return [];
    const documentCount = byFolder.get(folder) ?? 0;
    if (documentCount === 0) return [];
    return [{ folder, label: FOLDER_LABELS[folder], documentCount }];
  });
}

function groupApplications(apps: DashboardApplication[]): ApplicationDepartmentFolder[] {
  const departments = new Map<string, { title: string; types: Map<string, ApplicationTypeFolder> }>();
  for (const app of apps) {
    const departmentTitle =
      app.department && app.department !== "—" ? app.department.trim() : "Other";
    const departmentKey = departmentTitle.toLowerCase();
    const department = departments.get(departmentKey) ?? {
      title: departmentTitle,
      types: new Map<string, ApplicationTypeFolder>(),
    };
    const typeTitle = app.permissionType.trim() || "Application";
    const typeKey = typeTitle.toLowerCase();
    const typeFolder = department.types.get(typeKey) ?? {
      key: typeKey,
      title: typeTitle,
      applications: [],
    };
    typeFolder.applications.push(app);
    department.types.set(typeKey, typeFolder);
    departments.set(departmentKey, department);
  }
  return [...departments.entries()]
    .map(([key, department]) => ({
      key,
      title: department.title,
      types: [...department.types.values()].sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => {
      if (a.title === "Building Permission") return -1;
      if (b.title === "Building Permission") return 1;
      return a.title.localeCompare(b.title);
    });
}

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
  application_urls?: unknown;
};

async function loadLibraryProjectRecords(
  projects: { id: string }[]
): Promise<LibraryProjectRecord[]> {
  const projectIds = projects.map((p) => p.id);
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, title, project_info, save_plot_details, project_library, application_urls"
    )
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
        application_urls: project.application_urls,
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

type LibrarySnapshot = {
  records: LibraryProjectRecord[];
  rows: LibraryRow[];
  applications: DashboardApplication[];
};

const librarySnapshotCache = new Map<string, LibrarySnapshot>();

function librarySnapshotKey(projectIds: string[]): string {
  return [...projectIds].sort().join(",");
}

function countLabel(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
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
  if (raw.includes("/saved-applications/") || isDocumentDraftStoragePath(raw)) return [raw];

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

type LibraryBrowseNode = {
  id: string;
  label: string;
  hint?: string;
  children?: LibraryBrowseNode[];
};

function selectedBrowsePath(nodes: LibraryBrowseNode[], targetId: string): LibraryBrowseNode[] {
  const walk = (list: LibraryBrowseNode[], trail: LibraryBrowseNode[]): LibraryBrowseNode[] | null => {
    for (const node of list) {
      const next = [...trail, node];
      if (node.id === targetId) return next;
      if (node.children) {
        const found = walk(node.children, next);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(nodes, []) ?? [];
}

function LibraryBrowse({
  nodes,
  selectedId,
  countLabel,
  onSelect,
}: {
  nodes: LibraryBrowseNode[];
  selectedId: string;
  countLabel: string;
  onSelect: (id: string) => void;
}) {
  const steps = [
    { id: "all", label: "All folders" },
    ...(selectedId === "all" ? [] : selectedBrowsePath(nodes, selectedId)),
  ];

  return (
    <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        return (
          <div key={step.id} className="flex min-w-0 shrink-0 items-center gap-2">
            {index > 0 ? <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" /> : null}
            <button
              type="button"
              onClick={() => onSelect(step.id)}
              aria-current={last ? "page" : undefined}
              className={`flex min-w-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${
                last
                  ? "border border-slate-300 bg-white shadow-sm"
                  : "border border-slate-200 bg-white shadow-sm hover:border-slate-300"
              }`}
            >
              {index === 0 ? (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <Folder className="h-4 w-4" />
                </span>
              ) : null}
              <span className="min-w-0">
                {index === 0 ? (
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Browse
                  </span>
                ) : null}
                <span className="block max-w-[220px] truncate text-sm font-semibold text-slate-900">
                  {step.label}
                </span>
              </span>
              {last ? (
                <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {countLabel}
                </span>
              ) : null}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function DropdownRow({
  title,
  subtitle,
  selected = false,
  expandable = false,
  open = false,
  onClick,
  icon = "folder",
}: {
  title: string;
  subtitle?: string;
  selected?: boolean;
  expandable?: boolean;
  open?: boolean;
  onClick: () => void;
  icon?: "folder" | "file";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
        selected
          ? "border border-slate-300 bg-white shadow-sm"
          : "border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          selected ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
        }`}
      >
        {icon === "file" ? <FileText className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-900">{title}</span>
        {subtitle ? <span className="block truncate text-xs text-gray-500">{subtitle}</span> : null}
      </span>
      {expandable ? (
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "" : "-rotate-90"}`} />
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
      )}
    </button>
  );
}

function LibraryDropdown({
  nodes,
  selectedId,
  onSelect,
  leaf,
}: {
  nodes: LibraryBrowseNode[];
  selectedId: string;
  onSelect: (id: string) => void;
  leaf: ReactNode;
}) {
  const path = selectedId === "all" ? [] : selectedBrowsePath(nodes, selectedId);
  const resolved: LibraryBrowseNode[] = [];
  let level = nodes;
  for (const step of path) {
    const next = level.find((node) => node.id === step.id) ?? step;
    resolved.push(next);
    level = next.children ?? [];
  }
  const deepest = resolved[resolved.length - 1];
  const choices = resolved.length === 0 ? nodes : (deepest?.children ?? []);
  const showLeaf = resolved.length > 0 && choices.length === 0;

  const renderSelected = (index: number): ReactNode => {
    const node = resolved[index];
    if (!node) return null;
    return (
      <div className="mt-1 ml-6 border-l border-slate-200 pl-3">
        <DropdownRow
          title={node.label}
          subtitle={node.hint}
          selected
          expandable
          open
          onClick={() => onSelect(node.id)}
        />
        {index < resolved.length - 1 ? renderSelected(index + 1) : null}
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      <div className="shrink-0 bg-slate-50/70 px-3 pt-3">
        <DropdownRow
          title="All folders"
          selected
          expandable
          open
          onClick={() => onSelect("all")}
        />
        {renderSelected(0)}
      </div>
      <div className="px-3 pb-3">
        <div
          className="mt-1 flex flex-col gap-1 border-l border-slate-200 pl-3"
          style={{ marginLeft: `${(resolved.length + 1) * 1.5}rem` }}
        >
          {showLeaf
            ? leaf
            : choices.map((node) => (
                <DropdownRow
                  key={node.id}
                  title={node.label}
                  subtitle={node.hint}
                  expandable={Boolean(node.children?.length)}
                  onClick={() => onSelect(node.id)}
                />
              ))}
        </div>
      </div>
    </div>
  );
}

type ApplicationTypeFolder = {
  key: string;
  title: string;
  applications: DashboardApplication[];
};

type ApplicationDepartmentFolder = {
  key: string;
  title: string;
  types: ApplicationTypeFolder[];
};

export default function ProjectLibraryBrowserPage() {
  const { projects, loading: projectsLoading, isConsultant } = useDashboardProjects();
  const { masterProjectId } = useMasterProjectFilter();
  const [projectRecords, setProjectRecords] = useState<LibraryProjectRecord[]>(
    []
  );
  const [rows, setRows] = useState<LibraryRow[]>([]);
  const [applications, setApplications] = useState<DashboardApplication[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [section, setSection] = useState<LibrarySection | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<FolderSection | null>(
    null
  );
  const [selectedDepartmentKey, setSelectedDepartmentKey] = useState<string | null>(null);
  const [selectedTypeKey, setSelectedTypeKey] = useState<string | null>(null);
  const [catalogTypes, setCatalogTypes] = useState<ApplicationCatalogType[]>([]);
  const [catalogTypesLoaded, setCatalogTypesLoaded] = useState(false);
  const [documentsByTypeId, setDocumentsByTypeId] = useState<
    Record<string, ApplicationCatalogDocument[]>
  >({});
  const [preview, setPreview] = useState<{
    url: string;
    title: string;
    html?: string | null;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewBlobRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      let userId = sessionData.session?.user?.id ?? null;
      if (!userId) {
        const { data: authData } = await supabase.auth.getUser();
        userId = authData.user?.id ?? null;
      }

      const liveProjectIds = projects.map((project) => String(project.id));
      const projectIds = masterProjectId
        ? [masterProjectId]
        : liveProjectIds.length > 0
          ? liveProjectIds
          : userId
            ? readRememberedDashboardProjectIds(userId)
            : [];
      if (projectIds.length === 0) {
        if (!projectsLoading && !masterProjectId && !cancelled) {
          setProjectRecords([]);
          setRows([]);
          setApplications([]);
          setFilesLoading(false);
        }
        return;
      }

      const cacheKey = librarySnapshotKey(projectIds);
      const cached = librarySnapshotCache.get(cacheKey);
      if (cached && !cancelled) {
        setProjectRecords(cached.records);
        setRows(cached.rows);
        setApplications(cached.applications);
        setFilesLoading(false);
      } else if (!cancelled) {
        setFilesLoading(true);
      }

      const libraryProjects = projectIds.map((id) => ({ id }));
      const [records, savedDocuments, applicationList] = await Promise.all([
        loadLibraryProjectRecords(libraryProjects),
        fetchSavedApplicationDocuments().catch((err) => {
          console.error("Failed to load saved application documents:", err);
          return [];
        }),
        userId
          ? fetchApplicationsList({
              userId,
              isConsultant,
              projectIds,
            }).catch((err) => {
              console.error("Failed to load applications:", err);
              return [] as DashboardApplication[];
            })
          : Promise.resolve([] as DashboardApplication[]),
      ]);
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

      const recordById = new Map(records.map((project) => [project.id, project]));
      const projectIdSet = new Set(projectIds);
      for (const item of savedDocuments) {
        if (!projectIdSet.has(item.projectId)) continue;
        const project = recordById.get(item.projectId);
        const projectLabel = project
          ? getProjectLabel({
              title: project.title,
              project_info: project.project_info as {
                proposalNo?: string;
                title?: string;
              } | null,
            })
          : item.projectTitle || item.projectId;
        nextRows.push({
          id: `${item.projectId}-saved-${item.typeSlug}-${item.documentSlug}`,
          projectId: item.projectId,
          projectLabel,
          authority: project
            ? getPlanningAuthority(project.save_plot_details)
            : "—",
          fileName: projectLabel,
          folder: "saved-applications",
          folderLabel: FOLDER_LABELS["saved-applications"],
          path: item.pdfPath,
          url: publicUrlForPath(item.pdfPath),
          uploadedAt: item.updatedAt || null,
          savedTypeSlug: item.typeSlug,
          savedTypeTitle: item.typeTitle,
          savedDocumentSlug: item.documentSlug,
          savedDocumentTitle: item.documentCategory,
        });
      }

      const snapshot = {
        records,
        rows: nextRows,
        applications: applicationList,
      };
      librarySnapshotCache.set(cacheKey, snapshot);
      setProjectRecords(records);
      setRows(nextRows);
      setApplications(applicationList);
      setFilesLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [projects, projectsLoading, isConsultant, masterProjectId]);

  const projectOptions = useMemo(() => {
    return projectRecords.map((project) => ({
      id: project.id,
      label: getProjectLabel({
        title: project.title,
        project_info: project.project_info as {
          proposalNo?: string;
          title?: string;
        } | null,
      }),
    }));
  }, [projectRecords]);

  const projectFilter =
    masterProjectId && projectRecords.some((project) => project.id === masterProjectId)
      ? masterProjectId
      : "ALL";

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (projectFilter !== "ALL" && row.projectId !== projectFilter) {
        return false;
      }
      return true;
    });
  }, [rows, projectFilter]);

  const documentRows = useMemo(
    () => filtered.filter((row) => row.folder !== "saved-applications"),
    [filtered]
  );

  const filteredApplications = useMemo(() => {
    if (projectFilter === "ALL") return applications;
    return applications.filter((app) => app.projectId === projectFilter);
  }, [applications, projectFilter]);

  const documentProjectFolders = useMemo((): ProjectFolderSummary[] => {
    const byProject = new Map<string, ProjectFolderSummary>();
    for (const row of documentRows) {
      const entry = byProject.get(row.projectId) ?? {
        id: row.projectId,
        label: row.projectLabel,
        documentCount: 0,
      };
      entry.documentCount += 1;
      byProject.set(row.projectId, entry);
    }
    return [...byProject.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [documentRows]);

  const applicationProjectFolders = useMemo((): ProjectFolderSummary[] => {
    const byProject = new Map<string, ProjectFolderSummary>();
    for (const app of filteredApplications) {
      const entry = byProject.get(app.projectId) ?? {
        id: app.projectId,
        label:
          projectOptions.find((project) => project.id === app.projectId)?.label ||
          app.projectTitle ||
          "Project",
        documentCount: 0,
      };
      entry.documentCount += 1;
      byProject.set(app.projectId, entry);
    }
    return [...byProject.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [filteredApplications, projectOptions]);

  const applicationRootFolderCount = useMemo(() => {
    if (projectFilter === "ALL") return applicationProjectFolders.length;
    const departments = new Set(
      filteredApplications.map((app) =>
        (app.department && app.department !== "—" ? app.department.trim() : "Other").toLowerCase()
      )
    );
    return departments.size;
  }, [projectFilter, applicationProjectFolders.length, filteredApplications]);

  const projectRows = useMemo(() => {
    if (!selectedProjectId) return [];
    return documentRows.filter((row) => row.projectId === selectedProjectId);
  }, [documentRows, selectedProjectId]);

  const documentTypeFolders = useMemo(() => {
    if (section !== "documents" || !selectedProjectId) return [];
    const byFolder = new Map<FolderSection, number>();
    for (const row of projectRows) {
      byFolder.set(row.folder, (byFolder.get(row.folder) ?? 0) + 1);
    }
    return FOLDER_ORDER.flatMap((folder) => {
      if (folder === "saved-applications") return [];
      const documentCount = byFolder.get(folder) ?? 0;
      if (documentCount === 0) return [];
      return [{ folder, label: FOLDER_LABELS[folder], documentCount }];
    });
  }, [section, selectedProjectId, projectRows]);

  const documentFiles = useMemo(() => {
    if (section !== "documents" || !selectedFolder) return [];
    return projectRows.filter((row) => row.folder === selectedFolder);
  }, [section, projectRows, selectedFolder]);

  const applicationDepartments = useMemo((): ApplicationDepartmentFolder[] => {
    if (!selectedProjectId) return [];
    return groupApplications(
      filteredApplications.filter((app) => app.projectId === selectedProjectId)
    );
  }, [filteredApplications, selectedProjectId]);

  const selectedDepartment =
    applicationDepartments.find((folder) => folder.key === selectedDepartmentKey) ?? null;
  const selectedTypeFolder =
    selectedDepartment?.types.find((folder) => folder.key === selectedTypeKey) ?? null;

  useEffect(() => {
    let cancelled = false;
    void fetchApplicationCatalogTypes().then((types) => {
      if (cancelled) return;
      setCatalogTypes(types);
      setCatalogTypesLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCatalogType = useMemo(() => {
    const title = selectedTypeFolder?.title.trim().toLowerCase();
    if (!title) return null;
    return (
      catalogTypes.find((type) => type.application_title.trim().toLowerCase() === title) ?? null
    );
  }, [catalogTypes, selectedTypeFolder]);

  useEffect(() => {
    const typeId = selectedCatalogType?.id;
    if (!typeId || documentsByTypeId[typeId]) return;
    let cancelled = false;
    void fetchDocumentsForApplicationType(typeId).then((docs) => {
      if (cancelled) return;
      setDocumentsByTypeId((prev) => ({ ...prev, [typeId]: docs }));
    });
    return () => {
      cancelled = true;
    };
  }, [selectedCatalogType, documentsByTypeId]);

  const selectedTypeDocuments = selectedCatalogType
    ? (documentsByTypeId[selectedCatalogType.id] ?? [])
    : [];

  const clearDeeperThanSection = () => {
    setSelectedProjectId(null);
    setSelectedFolder(null);
    setSelectedDepartmentKey(null);
    setSelectedTypeKey(null);
  };

  useEffect(() => {
    if (!section || !selectedProjectId) return;
    const stillExists =
      section === "documents"
        ? documentRows.some((row) => row.projectId === selectedProjectId)
        : filteredApplications.some((app) => app.projectId === selectedProjectId);
    if (!stillExists) {
      setSelectedProjectId(null);
      setSelectedFolder(null);
      setSelectedDepartmentKey(null);
      setSelectedTypeKey(null);
    }
  }, [section, documentRows, filteredApplications, selectedProjectId]);

  useEffect(() => {
    if (!selectedFolder) return;
    if (!documentTypeFolders.some((folder) => folder.folder === selectedFolder)) {
      setSelectedFolder(null);
    }
  }, [documentTypeFolders, selectedFolder]);

  useEffect(() => {
    if (!selectedDepartmentKey) return;
    if (!applicationDepartments.some((folder) => folder.key === selectedDepartmentKey)) {
      setSelectedDepartmentKey(null);
      setSelectedTypeKey(null);
    }
  }, [applicationDepartments, selectedDepartmentKey]);

  useEffect(() => {
    if (!selectedTypeKey) return;
    if (!selectedDepartment?.types.some((folder) => folder.key === selectedTypeKey)) {
      setSelectedTypeKey(null);
    }
  }, [selectedDepartment, selectedTypeKey]);

  const fileRows = section === "documents" && selectedFolder ? documentFiles : null;
  const visibleProjectFolders =
    section === "applications" ? applicationProjectFolders : documentProjectFolders;

  const typeDocumentsReady =
    catalogTypesLoaded &&
    (!selectedCatalogType || selectedCatalogType.id in documentsByTypeId);

  const panelCount = fileRows
    ? countLabel(fileRows.length, "document")
    : selectedTypeFolder && selectedTypeDocuments.length > 0
      ? countLabel(selectedTypeDocuments.length, "document")
      : selectedTypeFolder && !typeDocumentsReady
        ? "Loading…"
      : selectedTypeFolder
      ? countLabel(selectedTypeFolder.applications.length, "application")
      : selectedDepartment
        ? countLabel(selectedDepartment.types.length, "folder")
        : selectedProjectId && section === "documents"
          ? countLabel(documentTypeFolders.length, "folder")
          : selectedProjectId && section === "applications"
            ? countLabel(applicationDepartments.length, "folder")
            : section
              ? countLabel(visibleProjectFolders.length, "project")
              : "2 folders";

  const openSection = (next: LibrarySection) => {
    setSelectedFolder(null);
    setSelectedDepartmentKey(null);
    setSelectedTypeKey(null);
    setSection(next);
    setSelectedProjectId(projectFilter === "ALL" ? null : projectFilter);
  };

  const browseNodes = useMemo((): LibraryBrowseNode[] => {
    const projectScoped = projectFilter !== "ALL";
    const documentProjects = projectScoped
      ? documentProjectFolders.filter((folder) => folder.id === projectFilter)
      : documentProjectFolders;
    const applicationProjects = projectScoped
      ? applicationProjectFolders.filter((folder) => folder.id === projectFilter)
      : applicationProjectFolders;

    const documentTypeNodes = (projectId: string): LibraryBrowseNode[] =>
      documentTypesForProject(documentRows, projectId).map((folder) => ({
        id: `documents|${projectId}|${folder.folder}`,
        label: folder.label,
        hint: countLabel(folder.documentCount, "document"),
      }));

    const departmentNodes = (projectId: string): LibraryBrowseNode[] =>
      groupApplications(filteredApplications.filter((app) => app.projectId === projectId)).map(
        (department) => ({
          id: `applications|${projectId}|${encodeURIComponent(department.key)}`,
          label: department.title,
          hint: countLabel(department.types.length, "folder"),
          children: department.types.map((type) => ({
            id: `applications|${projectId}|${encodeURIComponent(department.key)}|${encodeURIComponent(type.key)}`,
            label: type.title,
            hint: countLabel(type.applications.length, "application"),
          })),
        })
      );

    const documentChildren: LibraryBrowseNode[] = projectScoped
      ? documentTypeNodes(projectFilter)
      : documentProjects.map((project) => ({
          id: `documents|${project.id}`,
          label: project.label,
          hint: countLabel(project.documentCount, "document"),
          children: documentTypeNodes(project.id),
        }));

    const applicationChildren: LibraryBrowseNode[] = projectScoped
      ? departmentNodes(projectFilter)
      : applicationProjects.map((project) => ({
          id: `applications|${project.id}`,
          label: project.label,
          hint: countLabel(project.documentCount, "application"),
          children: departmentNodes(project.id),
        }));

    return [
      {
        id: "documents",
        label: "Project Documents",
        hint: countLabel(documentRows.length, "document"),
        children: documentChildren,
      },
      {
        id: "applications",
        label: "Project Applications",
        hint: countLabel(applicationRootFolderCount, "folder"),
        children: applicationChildren,
      },
    ];
  }, [
    projectFilter,
    documentProjectFolders,
    applicationProjectFolders,
    documentRows,
    filteredApplications,
    applicationRootFolderCount,
  ]);

  const selectedBrowseId = !section
    ? "all"
    : section === "documents"
      ? selectedFolder && selectedProjectId
        ? `documents|${selectedProjectId}|${selectedFolder}`
        : selectedProjectId && projectFilter === "ALL"
          ? `documents|${selectedProjectId}`
          : "documents"
      : selectedTypeKey && selectedDepartmentKey && selectedProjectId
        ? `applications|${selectedProjectId}|${encodeURIComponent(selectedDepartmentKey)}|${encodeURIComponent(selectedTypeKey)}`
        : selectedDepartmentKey && selectedProjectId
          ? `applications|${selectedProjectId}|${encodeURIComponent(selectedDepartmentKey)}`
          : selectedProjectId && projectFilter === "ALL"
            ? `applications|${selectedProjectId}`
            : "applications";

  const onBrowseSelect = (id: string) => {
    if (id === "all") {
      setSection(null);
      clearDeeperThanSection();
      return;
    }
    if (id === "documents" || id === "applications") {
      openSection(id);
      return;
    }
    const [kind, projectId, third, fourth] = id.split("|");
    if (!projectId) return;
    setSelectedFolder(null);
    setSelectedDepartmentKey(null);
    setSelectedTypeKey(null);
    setSelectedProjectId(projectId);
    if (kind === "documents") {
      setSection("documents");
      if (third) setSelectedFolder(third as FolderSection);
      return;
    }
    setSection("applications");
    if (third) setSelectedDepartmentKey(decodeURIComponent(third));
    if (fourth) setSelectedTypeKey(decodeURIComponent(fourth));
  };

  const sectionRef = useRef(section);
  sectionRef.current = section;
  useEffect(() => {
    if (!sectionRef.current) return;
    setSelectedFolder(null);
    setSelectedDepartmentKey(null);
    setSelectedTypeKey(null);
    setSelectedProjectId(projectFilter === "ALL" ? null : projectFilter);
  }, [projectFilter]);

  const loading = filesLoading;

  const closePreview = () => {
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(false);
    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current);
      previewBlobRef.current = null;
    }
  };

  const savedRowForCatalogDocument = (doc: ApplicationCatalogDocument): LibraryRow | null => {
    if (!selectedProjectId || !selectedTypeFolder) return null;
    const typeTitle = selectedTypeFolder.title.trim().toLowerCase();
    const typeSlug = selectedCatalogType?.slug.trim().toLowerCase() || "";
    const docSlug = doc.slug.trim().toLowerCase();
    const category = doc.category.trim().toLowerCase();
    return (
      rows.find((row) => {
        if (row.folder !== "saved-applications" || row.projectId !== selectedProjectId) return false;
        const rowType = (row.savedTypeTitle || "").trim().toLowerCase();
        const rowTypeSlug = (row.savedTypeSlug || "").trim().toLowerCase();
        const typeMatches = rowType === typeTitle || (typeSlug && rowTypeSlug === typeSlug);
        if (!typeMatches) return false;
        const rowDoc = (row.savedDocumentSlug || "").trim().toLowerCase();
        const rowTitle = (row.savedDocumentTitle || "").trim().toLowerCase();
        return rowDoc === docSlug || rowTitle === category;
      }) ?? null
    );
  };

  const savedRowForApplicationType = (): LibraryRow | null => {
    if (!selectedProjectId || !selectedTypeFolder) return null;
    const typeTitle = selectedTypeFolder.title.trim().toLowerCase();
    const typeSlug = selectedCatalogType?.slug.trim().toLowerCase() || "";
    return (
      rows.find((row) => {
        if (row.folder !== "saved-applications" || row.projectId !== selectedProjectId) return false;
        const rowType = (row.savedTypeTitle || "").trim().toLowerCase();
        const rowTypeSlug = (row.savedTypeSlug || "").trim().toLowerCase();
        return rowType === typeTitle || (typeSlug && rowTypeSlug === typeSlug);
      }) ?? null
    );
  };

  const openApplicationHtmlPreview = async (
    title: string,
    doc?: ApplicationCatalogDocument | null
  ) => {
    if (!selectedProjectId || !selectedTypeFolder) {
      setPreviewLoading(false);
      setPreview({ url: "", title, html: null });
      setPreviewError("Could not load the saved PDF.");
      return;
    }
    const project = projectRecords.find((record) => record.id === selectedProjectId);
    const storedUrl = doc
      ? readApplicationUrlFromUrls(project?.application_urls, doc.slug) ||
        readApplicationUrlFromUrls(project?.application_urls, doc.id)
      : undefined;
    if (storedUrl) {
      setPreviewLoading(false);
      setPreviewError(null);
      setPreview({ url: storedUrl, title, html: null });
      return;
    }

    setPreviewError(null);
    setPreviewLoading(true);
    setPreview({ url: "", title, html: null });
    try {
      const templateType = mapSelectedApplicationToTemplate(selectedTypeFolder.title);
      const createdAt = selectedTypeFolder.applications[0]?.createdAt ?? null;
      const source: ApplicationPreviewSource = {
        projectId: selectedProjectId,
        selectedApplication: selectedTypeFolder.title,
        applicationCreatedAt: createdAt,
        catalogDocumentId: doc?.id ?? null,
        resolvedCatalogDocument: doc ?? null,
        resolvedApplicantType: selectedCatalogType?.applicant_type ?? null,
        letterVariant: doc?.letter_variant === "acceptance" ? "acceptance" : "appointment",
        projectData: {
          title: project?.title,
          project_info: project?.project_info as NonNullable<
            ApplicationPreviewSource["projectData"]
          >["project_info"],
          save_plot_details: project?.save_plot_details as NonNullable<
            ApplicationPreviewSource["projectData"]
          >["save_plot_details"],
        },
      };
      const html = await generateApplicationPreviewHtml(
        mapApplicationPreviewFields(source, templateType),
        templateType,
        source
      );
      if (!html.trim()) {
        setPreview({ url: "", title, html: null });
        setPreviewError("Could not load the saved PDF.");
        return;
      }
      setPreviewError(null);
      setPreview({ url: "", title, html });
    } catch (err) {
      console.error("Failed to build application preview:", err);
      setPreview({ url: "", title, html: null });
      setPreviewError("Could not load the saved PDF.");
    } finally {
      setPreviewLoading(false);
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
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-contain px-2 py-3 sm:px-3">
      <DocumentPreviewModal
        open={Boolean(preview) || previewLoading || Boolean(previewError)}
        onClose={closePreview}
        fileUrl={preview?.html ? null : preview?.url || null}
        htmlContent={preview?.html || null}
        title={preview?.title || "Document Preview"}
        hideSaveButton
        isLoading={previewLoading}
        loadError={previewError}
      />

      <div className="flex flex-col rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="shrink-0 border-b border-slate-200/80 bg-slate-50 px-3 py-3">
          <LibraryBrowse
            nodes={browseNodes}
            selectedId={selectedBrowseId}
            countLabel={loading ? "Loading…" : panelCount}
            onSelect={onBrowseSelect}
          />
        </div>

        <div className="flex flex-col bg-slate-50/70">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin text-brand-blue" />
              Loading documents…
            </div>
          ) : (
            <LibraryDropdown
              nodes={browseNodes}
              selectedId={selectedBrowseId}
              onSelect={onBrowseSelect}
              leaf={
                section === "applications" && selectedTypeFolder && !typeDocumentsReady ? (
                  <div className="flex items-center gap-2 px-3 py-3 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin text-brand-blue" />
                    Loading documents…
                  </div>
                ) : section === "applications" &&
                  selectedTypeFolder &&
                  selectedTypeDocuments.length > 0 ? (
                  selectedTypeDocuments.map((doc) => (
                    <DropdownRow
                      key={doc.id}
                      title={catalogDocumentOptionLabel(doc)}
                      subtitle={countLabel(selectedTypeFolder.applications.length, "application")}
                      onClick={() => {
                        const saved = savedRowForCatalogDocument(doc);
                        if (saved) {
                          void openPreview(saved);
                          return;
                        }
                        void openApplicationHtmlPreview(catalogDocumentOptionLabel(doc), doc);
                      }}
                    />
                  ))
                ) : section === "applications" && selectedTypeFolder ? (
                  selectedTypeFolder.applications.length > 0 ? (
                    selectedTypeFolder.applications.map((app) => (
                      <DropdownRow
                        key={app.id}
                        title={app.projectTitle || app.permissionType}
                        subtitle={`${app.permissionType} · ${formatUploadedAt(app.createdAt ?? null)}`}
                        icon="file"
                        onClick={() => {
                          const saved = savedRowForApplicationType();
                          if (saved) {
                            void openPreview(saved);
                            return;
                          }
                          void openApplicationHtmlPreview(
                            app.permissionType || app.projectTitle || "Application"
                          );
                        }}
                      />
                    ))
                  ) : (
                    <p className="px-3 py-3 text-sm text-gray-500">No applications in this folder.</p>
                  )
                ) : fileRows && fileRows.length > 0 ? (
                  fileRows.map((row) => (
                    <DropdownRow
                      key={row.id}
                      title={row.fileName}
                      subtitle={`${row.projectLabel} · ${formatUploadedAt(row.uploadedAt)}`}
                      icon="file"
                      onClick={() => void openPreview(row)}
                    />
                  ))
                ) : section ? (
                  <div className="flex items-center gap-2 px-3 py-3 text-sm text-gray-500">
                    <CircleDashed className="h-4 w-4 text-gray-300" />
                    No documents in this folder.
                  </div>
                ) : null
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
