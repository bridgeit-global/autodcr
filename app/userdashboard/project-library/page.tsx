"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  CircleDashed,
  FileText,
  Folder,
  Library,
  Loader2,
} from "lucide-react";
import CustomSelect from "@/app/components/CustomSelect";
import { useMasterProjectFilter } from "@/app/components/appshell/MasterProjectFilterContext";
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

function FolderCard({
  title,
  subtitle,
  onClick,
  active = false,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl border bg-white p-4 text-left shadow-sm transition-all hover:border-brand-blue/30 hover:shadow-md ${
        active ? "border-brand-blue/40 ring-2 ring-brand-blue/20" : "border-gray-100"
      }`}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand-blue ring-1 ring-blue-100/80">
        <Folder className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-brand-navy">{title}</p>
        <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
    </button>
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
  const { masterProjectId, setMasterProjectId } = useMasterProjectFilter();
  const [projectRecords, setProjectRecords] = useState<LibraryProjectRecord[]>(
    []
  );
  const [rows, setRows] = useState<LibraryRow[]>([]);
  const [applications, setApplications] = useState<DashboardApplication[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState("ALL");
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
      if (projectsLoading) return;
      if (projects.length === 0) {
        if (!cancelled) {
          setProjectRecords([]);
          setRows([]);
          setApplications([]);
          setFilesLoading(false);
        }
        return;
      }

      setFilesLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      const [records, savedDocuments, applicationList] = await Promise.all([
        loadLibraryProjectRecords(projects),
        fetchSavedApplicationDocuments().catch((err) => {
          console.error("Failed to load saved application documents:", err);
          return [];
        }),
        userId
          ? fetchApplicationsList({
              userId,
              isConsultant,
              projectIds: projects.map((project) => String(project.id)),
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
      for (const item of savedDocuments) {
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

      setProjectRecords(records);
      setRows(nextRows);
      setApplications(applicationList);
      setFilesLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [projects, projectsLoading, isConsultant]);

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

  useEffect(() => {
    if (projectsLoading || filesLoading) return;
    if (!masterProjectId) {
      setProjectFilter("ALL");
      return;
    }
    if (projectRecords.some((project) => project.id === masterProjectId)) {
      setProjectFilter(masterProjectId);
    }
  }, [masterProjectId, projectsLoading, filesLoading, projectRecords]);

  useEffect(() => {
    if (filesLoading || projectFilter === "ALL") return;
    if (!projectOptions.some((p) => p.id === projectFilter)) {
      setProjectFilter("ALL");
    }
  }, [filesLoading, projectFilter, projectOptions]);

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
    const departments = new Map<
      string,
      { title: string; types: Map<string, ApplicationTypeFolder> }
    >();
    for (const app of filteredApplications) {
      if (app.projectId !== selectedProjectId) continue;
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

  const selectedProjectLabel =
    (section === "applications" ? applicationProjectFolders : documentProjectFolders).find(
      (folder) => folder.id === selectedProjectId
    )?.label ?? "Project";

  const clearDeeperThanSection = () => {
    setSelectedProjectId(null);
    setSelectedFolder(null);
    setSelectedDepartmentKey(null);
    setSelectedTypeKey(null);
  };

  const clearDeeperThanProject = () => {
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

  const sectionTitle =
    section === "documents"
      ? "Project Documents"
      : section === "applications"
        ? "Project Applications"
        : "All folders";

  const projectIsFiltered = projectFilter !== "ALL";

  const panelTitle = selectedTypeFolder
    ? selectedTypeFolder.title
    : selectedDepartment
      ? selectedDepartment.title
      : selectedFolder
        ? FOLDER_LABELS[selectedFolder]
        : selectedProjectId && !projectIsFiltered
          ? selectedProjectLabel
          : sectionTitle;

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

  const onLibraryChange = (value: string) => {
    if (value !== "documents" && value !== "applications") {
      setSection(null);
      clearDeeperThanSection();
      return;
    }
    openSection(value);
  };

  const onPathProjectChange = (value: string) => {
    clearDeeperThanProject();
    setSelectedProjectId(value || null);
  };

  const onDocumentTypeChange = (value: string) => {
    setSelectedFolder(value ? (value as FolderSection) : null);
  };

  const onDepartmentChange = (value: string) => {
    setSelectedTypeKey(null);
    setSelectedDepartmentKey(value || null);
  };

  const onApplicationTypeChange = (value: string) => {
    setSelectedTypeKey(value || null);
  };

  useEffect(() => {
    if (!section) return;
    setSelectedFolder(null);
    setSelectedDepartmentKey(null);
    setSelectedTypeKey(null);
    setSelectedProjectId(projectFilter === "ALL" ? null : projectFilter);
  }, [projectFilter, section]);

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
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden px-2 py-3 sm:px-3">
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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex shrink-0 flex-col gap-3 border-b border-gray-100 px-2 py-3 md:flex-row md:items-end">
          <div className="w-full min-w-0 md:max-w-md md:flex-1">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Project
            </label>
            <CustomSelect
              searchable
              value={projectFilter}
              onChange={(value) => {
                setProjectFilter(value);
                setMasterProjectId(value === "ALL" ? "" : value);
              }}
              options={[
                { value: "ALL", label: "All projects" },
                ...projectOptions.map((project) => ({
                  value: project.id,
                  label: project.label,
                })),
              ]}
              placeholder={loading ? "Loading…" : "All projects"}
              disabled={loading}
            />
          </div>
          <div className="grid min-w-0 flex-[2] grid-cols-1 gap-3 sm:grid-cols-2">
            <FolderCard
              title="Project Documents"
              subtitle={countLabel(documentRows.length, "document")}
              active={section === "documents"}
              onClick={() => openSection("documents")}
            />
            <FolderCard
              title="Project Applications"
              subtitle={countLabel(applicationRootFolderCount, "folder")}
              active={section === "applications"}
              onClick={() => openSection("applications")}
            />
          </div>
        </div>

        {section ? (
        <div className="flex shrink-0 flex-col gap-3 border-b border-gray-100 px-2 py-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <CustomSelect
                aria-label="Library"
                value={section}
                onChange={onLibraryChange}
                options={[
                  { value: "", label: "All folders" },
                  { value: "documents", label: "Project Documents" },
                  { value: "applications", label: "Project Applications" },
                ]}
              />
              {!projectIsFiltered ? (
                <CustomSelect
                  aria-label="Project folder"
                  searchable
                  value={selectedProjectId ?? ""}
                  onChange={onPathProjectChange}
                  options={[
                    { value: "", label: "All projects" },
                    ...visibleProjectFolders.map((folder) => ({
                      value: folder.id,
                      label: folder.label,
                    })),
                  ]}
                />
              ) : null}
              {section === "documents" && selectedProjectId ? (
                <CustomSelect
                  aria-label="Document type"
                  searchable
                  value={selectedFolder ?? ""}
                  onChange={onDocumentTypeChange}
                  options={[
                    { value: "", label: "All types" },
                    ...documentTypeFolders.map((folder) => ({
                      value: folder.folder,
                      label: folder.label,
                    })),
                  ]}
                />
              ) : null}
              {section === "applications" && selectedProjectId ? (
                <CustomSelect
                  aria-label="Department"
                  searchable
                  value={selectedDepartmentKey ?? ""}
                  onChange={onDepartmentChange}
                  options={[
                    { value: "", label: "All departments" },
                    ...applicationDepartments.map((folder) => ({
                      value: folder.key,
                      label: folder.title,
                    })),
                  ]}
                />
              ) : null}
              {section === "applications" && selectedDepartment ? (
                <CustomSelect
                  aria-label="Application type"
                  searchable
                  value={selectedTypeKey ?? ""}
                  onChange={onApplicationTypeChange}
                  options={[
                    { value: "", label: "All types" },
                    ...selectedDepartment.types.map((folder) => ({
                      value: folder.key,
                      label: folder.title,
                    })),
                  ]}
                />
              ) : null}
            </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-brand-navy">{panelTitle}</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {loading ? "Loading…" : panelCount}
            </p>
          </div>
        </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 overscroll-contain">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin text-brand-blue" />
              Loading documents…
            </div>
          ) : !section ? null : !selectedProjectId ? (
            visibleProjectFolders.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
                {section === "documents" ? (
                  <Library className="h-8 w-8 text-gray-300" />
                ) : (
                  <CircleDashed className="h-8 w-8 text-gray-300" />
                )}
                <p className="text-sm text-gray-500">
                  {section === "documents"
                    ? "No library documents uploaded yet."
                    : "No applications for this project."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 px-2 py-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleProjectFolders.map((folder) => (
                  <FolderCard
                    key={folder.id}
                    title={folder.label}
                    subtitle={countLabel(
                      folder.documentCount,
                      section === "applications" ? "application" : "document"
                    )}
                    onClick={() => {
                      clearDeeperThanProject();
                      setSelectedProjectId(folder.id);
                    }}
                  />
                ))}
              </div>
            )
          ) : section === "documents" && !selectedFolder ? (
            <div className="grid grid-cols-1 gap-3 px-2 py-3 sm:grid-cols-2 lg:grid-cols-3">
              {documentTypeFolders.map((folder) => (
                <FolderCard
                  key={folder.folder}
                  title={folder.label}
                  subtitle={countLabel(folder.documentCount, "document")}
                  onClick={() => setSelectedFolder(folder.folder)}
                />
              ))}
            </div>
          ) : section === "applications" && !selectedDepartment ? (
            applicationDepartments.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
                <CircleDashed className="h-8 w-8 text-gray-300" />
                <p className="text-sm text-gray-500">No applications for this project.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 px-2 py-3 sm:grid-cols-2 lg:grid-cols-3">
                {applicationDepartments.map((folder) => {
                  const applicationCount = folder.types.reduce(
                    (total, type) => total + type.applications.length,
                    0
                  );
                  return (
                    <FolderCard
                      key={folder.key}
                      title={folder.title}
                      subtitle={countLabel(applicationCount, "application")}
                      onClick={() => {
                        setSelectedTypeKey(null);
                        setSelectedDepartmentKey(folder.key);
                      }}
                    />
                  );
                })}
              </div>
            )
          ) : section === "applications" && selectedDepartment && !selectedTypeFolder ? (
            <div className="grid grid-cols-1 gap-3 px-2 py-3 sm:grid-cols-2 lg:grid-cols-3">
              {selectedDepartment.types.map((folder) => (
                <FolderCard
                  key={folder.key}
                  title={folder.title}
                  subtitle={countLabel(folder.applications.length, "application")}
                  onClick={() => setSelectedTypeKey(folder.key)}
                />
              ))}
            </div>
          ) : section === "applications" && selectedTypeFolder && !typeDocumentsReady ? (
            <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin text-brand-blue" />
              Loading documents…
            </div>
          ) : section === "applications" && selectedTypeFolder && selectedTypeDocuments.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 px-2 py-3 sm:grid-cols-2 lg:grid-cols-3">
              {selectedTypeDocuments.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => {
                    const saved = savedRowForCatalogDocument(doc);
                    if (saved) {
                      void openPreview(saved);
                      return;
                    }
                    void openApplicationHtmlPreview(catalogDocumentOptionLabel(doc), doc);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-all hover:border-brand-blue/30 hover:shadow-md"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand-blue ring-1 ring-blue-100/80">
                    <Folder className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-brand-navy">
                      {catalogDocumentOptionLabel(doc)}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {countLabel(selectedTypeFolder.applications.length, "application")}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                </button>
              ))}
            </div>
          ) : section === "applications" && selectedTypeFolder ? (
            <div className="grid grid-cols-1 gap-3 px-2 py-3 sm:grid-cols-2 lg:grid-cols-3">
              {selectedTypeFolder.applications.map((app) => (
                <button
                  key={app.id}
                  type="button"
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
                  className="flex w-full items-start gap-3 rounded-xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-all hover:border-brand-blue/30 hover:shadow-md"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand-blue ring-1 ring-blue-100/80">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold text-brand-navy">
                      {app.projectTitle || app.permissionType}
                    </p>
                    <p className="mt-1 truncate text-xs text-gray-500">{app.permissionType}</p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {formatUploadedAt(app.createdAt ?? null)}
                    </p>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
                </button>
              ))}
            </div>
          ) : fileRows && fileRows.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 px-2 py-3 sm:grid-cols-2 lg:grid-cols-3">
              {fileRows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => void openPreview(row)}
                  disabled={!row.url && !row.path}
                  className="flex w-full items-start gap-3 rounded-xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-all hover:border-brand-blue/30 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand-blue ring-1 ring-blue-100/80">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold text-brand-navy">
                      {row.fileName}
                    </p>
                    <p className="mt-1 truncate text-xs text-gray-500">{row.projectLabel}</p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">{row.authority}</p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {formatUploadedAt(row.uploadedAt)}
                    </p>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
              <CircleDashed className="h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-500">
                No documents in this folder for the selected filters.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
