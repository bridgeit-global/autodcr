"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  GitCompare,
  History,
  Layers,
  Loader2,
  MessageSquare,
  MinusCircle,
  Pencil,
  RotateCcw,
  Share2,
  Sparkles,
  Upload,
} from "lucide-react";
import CustomSelect from "@/app/components/CustomSelect";
import Modal from "@/app/components/ui/Modal";
import { useUserMetadata } from "@/app/contexts/UserContext";
import { useDashboardProjects } from "@/app/hooks/useDashboardProjects";
import {
  filterNonDraftProjects,
  getProjectLabel,
} from "@/app/userdashboard/ownerWorkspaceConsultants";
import CadViewerHost from "@/app/userdashboard/drawings/CadViewerHost";
import {
  REDLINE_COLORS,
  SAMPLE_KEY_CHANGES,
  SAMPLE_REMARKS,
  type DrawingRemark,
  type DrawingReviewMode,
  type DrawingVersion,
  type KeyChange,
  type RedlineMark,
} from "@/app/userdashboard/drawings/drawingsData";
import { BTN_PRIMARY, BTN_SECONDARY } from "@/app/utils/buttonClasses";

type ViewerMode = Exclude<DrawingReviewMode, "redline"> | "view";

function formatDateLabel(date: Date): string {
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

function isCadFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".dwg") || name.endsWith(".dxf");
}

function keyChangeIcon(tone: KeyChange["tone"]) {
  if (tone === "up") return <ArrowUpRight className="h-3.5 w-3.5 text-red-600" />;
  if (tone === "down") return <MinusCircle className="h-3.5 w-3.5 text-red-500" />;
  if (tone === "ok") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
  return <Sparkles className="h-3.5 w-3.5 text-amber-500" />;
}

export default function DrawingReviewClient() {
  const { userMetadata } = useUserMetadata();
  const { projects, loading: projectsLoading } = useDashboardProjects();
  const nonDraftProjects = useMemo(() => filterNonDraftProjects(projects), [projects]);

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [mode, setMode] = useState<DrawingReviewMode>("view");
  const [overlayOpacity, setOverlayOpacity] = useState(0.45);
  const [versions, setVersions] = useState<DrawingVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);
  const [keyChanges, setKeyChanges] = useState<KeyChange[]>(SAMPLE_KEY_CHANGES);
  const [remarks, setRemarks] = useState<DrawingRemark[]>(SAMPLE_REMARKS);
  const [redlines, setRedlines] = useState<RedlineMark[]>([]);
  const [redlineTool, setRedlineTool] = useState<"rect" | "pin">("rect");
  const [draftRect, setDraftRect] = useState<RedlineMark | null>(null);
  const [commentOpen, setCommentOpen] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [highlightVersions, setHighlightVersions] = useState(false);

  const buffersRef = useRef<Map<string, ArrayBuffer>>(new Map());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const versionsRef = useRef<HTMLDivElement | null>(null);

  const selectedProject = nonDraftProjects.find((p) => p.id === selectedProjectId) ?? nonDraftProjects[0];
  const projectValue = selectedProject?.id ?? "";
  const projectLabel = selectedProject ? getProjectLabel(selectedProject) : "No project";

  const reviewerName = useMemo(() => {
    const first = String(userMetadata?.first_name ?? "").trim();
    const last = String(userMetadata?.last_name ?? "").trim();
    const full = [first, last].filter(Boolean).join(" ");
    return full || "Reviewer";
  }, [userMetadata]);

  const reviewerRole = useMemo(() => {
    return (
      String(userMetadata?.consultant_type ?? "").trim() ||
      String(userMetadata?.role ?? "").trim() ||
      "Consultant"
    );
  }, [userMetadata]);

  const activeVersion = versions.find((v) => v.id === activeVersionId) ?? versions[0] ?? null;
  const compareVersion =
    versions.find((v) => v.id === compareVersionId) ??
    versions.find((v) => v.id !== activeVersion?.id) ??
    null;

  const primaryBuffer = activeVersion ? buffersRef.current.get(activeVersion.id) ?? null : null;
  const secondaryBuffer = compareVersion ? buffersRef.current.get(compareVersion.id) ?? null : null;
  const viewerMode: ViewerMode = mode === "redline" ? "view" : mode === "overlay" || mode === "compare" ? mode : "view";

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2400);
  };

  const addRemark = (body: string, author = reviewerName, role = reviewerRole) => {
    const remark: DrawingRemark = {
      id: `rm-${Date.now()}`,
      author,
      role,
      initials: initialsFromName(author === reviewerName ? reviewerName : role),
      dateLabel: formatDateLabel(new Date()),
      body,
    };
    setRemarks((prev) => [remark, ...prev]);
  };

  const ingestFile = async (file: File) => {
    if (!isCadFile(file)) {
      showToast("Please choose a DWG or DXF file");
      return;
    }
    const buffer = await file.arrayBuffer();
    const id = `ver-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    buffersRef.current.set(id, buffer);
    const version: DrawingVersion = {
      id,
      name: file.name.replace(/\.(dwg|dxf)$/i, ""),
      fileName: file.name,
      dateLabel: formatDateLabel(new Date(file.lastModified || Date.now())),
      status: versions.length === 0 ? "current" : "current",
    };
    setVersions((prev) => {
      const rest = prev.map((item) =>
        item.status === "current" ? { ...item, status: "previous" as const } : item
      );
      return [version, ...rest];
    });
    if (activeVersionId) setCompareVersionId(activeVersionId);
    setActiveVersionId(id);
    showToast(`Opened ${file.name}`);
  };

  const onPickFiles = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (file) void ingestFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    onPickFiles(event.dataTransfer.files);
  };

  const percentPoint = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
  };

  const onRedlinePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (mode !== "redline") return;
    const point = percentPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (redlineTool === "pin") {
      const mark: RedlineMark = {
        id: `rl-${Date.now()}`,
        kind: "pin",
        x: point.x,
        y: point.y,
        color: REDLINE_COLORS[redlines.length % REDLINE_COLORS.length],
        label: `Note ${redlines.length + 1}`,
      };
      setRedlines((prev) => [...prev, mark]);
      setKeyChanges((prev) => [
        { id: `kc-${Date.now()}`, label: mark.label || "Redline note", tone: "note" },
        ...prev,
      ]);
      return;
    }
    setDraftRect({
      id: "draft",
      kind: "rect",
      x: point.x,
      y: point.y,
      w: 0,
      h: 0,
      color: REDLINE_COLORS[redlines.length % REDLINE_COLORS.length],
    });
  };

  const onRedlinePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!draftRect) return;
    const point = percentPoint(event);
    setDraftRect((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        w: point.x - prev.x,
        h: point.y - prev.y,
      };
    });
  };

  const onRedlinePointerUp = () => {
    if (!draftRect) return;
    const w = Math.abs(draftRect.w ?? 0);
    const h = Math.abs(draftRect.h ?? 0);
    if (w > 1.5 && h > 1.5) {
      const mark: RedlineMark = {
        ...draftRect,
        id: `rl-${Date.now()}`,
        x: Math.min(draftRect.x, draftRect.x + (draftRect.w ?? 0)),
        y: Math.min(draftRect.y, draftRect.y + (draftRect.h ?? 0)),
        w,
        h,
        label: `Markup ${redlines.length + 1}`,
      };
      setRedlines((prev) => [...prev, mark]);
      setKeyChanges((prev) => [
        { id: `kc-${Date.now()}`, label: mark.label || "Area marked", tone: mark.color === "#16a34a" ? "ok" : "down" },
        ...prev,
      ]);
    }
    setDraftRect(null);
  };

  const approveActive = () => {
    if (!activeVersion) {
      showToast("Open a drawing first");
      return;
    }
    setVersions((prev) =>
      prev.map((item) =>
        item.id === activeVersion.id ? { ...item, status: "approved" as const } : item
      )
    );
    addRemark(`Approved ${activeVersion.name}.`);
    showToast("Drawing approved");
  };

  const submitComment = (kind: "comment" | "revision") => {
    const body = commentBody.trim();
    if (!body) return;
    addRemark(kind === "revision" ? `Revision requested: ${body}` : body);
    setCommentBody("");
    setCommentOpen(false);
    setRevisionOpen(false);
    showToast(kind === "revision" ? "Revision requested" : "Comment added");
  };

  const shareDrawing = async () => {
    const text = `${activeVersion?.fileName ?? "Drawing"} — Drawing Review (${projectLabel})`;
    try {
      await navigator.clipboard.writeText(text);
      showToast("Review note copied");
    } catch {
      showToast("Unable to copy");
    }
    if (activeVersion) {
      const buffer = buffersRef.current.get(activeVersion.id);
      if (buffer) {
        const blob = new Blob([buffer], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = activeVersion.fileName;
        link.click();
        URL.revokeObjectURL(url);
      }
    }
  };

  const toolbarButton = (
    id: DrawingReviewMode | "history" | "share",
    label: string,
    icon: ReactNode,
    onClick: () => void,
    active?: boolean
  ) => (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
        active
          ? "bg-blue-50 text-brand-blue ring-1 ring-inset ring-brand-blue/30"
          : "text-gray-600 hover:bg-gray-50 hover:text-brand-navy",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );

  const emptyState = (
    <div
      className="flex w-full max-w-md flex-col items-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/80 px-6 py-12 text-center"
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-brand-blue">
        <Upload className="h-6 w-6" />
      </span>
      <p className="mt-4 text-sm font-semibold text-brand-navy">Open a CAD drawing</p>
      <p className="mt-1 text-xs text-gray-500">Drop a DWG or DXF file here, or browse from your computer.</p>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className={`mt-4 rounded-lg px-4 py-2 text-sm font-semibold ${BTN_PRIMARY}`}
      >
        Open DWG / DXF
      </button>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-3 md:px-4 md:py-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".dwg,.dxf"
        className="hidden"
        onChange={(event) => onPickFiles(event.target.files)}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex shrink-0 flex-col gap-3 border-b border-gray-100 px-4 py-3 md:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-brand-navy md:text-2xl">
                Drawing Review & Comparison
              </h1>
              <p className="mt-1 text-sm text-gray-500">Review CAD versions, overlay changes, and leave remarks.</p>
            </div>
            <div className="w-full lg:max-w-sm">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                Project
              </label>
              <CustomSelect
                value={projectValue}
                onChange={setSelectedProjectId}
                options={
                  projectsLoading
                    ? []
                    : nonDraftProjects.map((project) => ({
                        value: project.id,
                        label: getProjectLabel(project),
                      }))
                }
                placeholder={projectsLoading ? "Loading projects…" : "Select a project"}
                disabled={projectsLoading || nonDraftProjects.length === 0}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {toolbarButton(
              "overlay",
              "Overlay",
              <Layers className="h-3.5 w-3.5" />,
              () => setMode((prev) => (prev === "overlay" ? "view" : "overlay")),
              mode === "overlay"
            )}
            {toolbarButton(
              "compare",
              "Compare",
              <GitCompare className="h-3.5 w-3.5" />,
              () => setMode((prev) => (prev === "compare" ? "view" : "compare")),
              mode === "compare"
            )}
            {toolbarButton(
              "redline",
              "Redline",
              <Pencil className="h-3.5 w-3.5" />,
              () => setMode((prev) => (prev === "redline" ? "view" : "redline")),
              mode === "redline"
            )}
            {toolbarButton("history", "History", <History className="h-3.5 w-3.5" />, () => {
              setHighlightVersions(true);
              versionsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
              window.setTimeout(() => setHighlightVersions(false), 1600);
            })}
            {toolbarButton("share", "Share", <Share2 className="h-3.5 w-3.5" />, () => {
              void shareDrawing();
            })}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-brand-blue hover:bg-blue-50"
            >
              <Upload className="h-3.5 w-3.5" />
              Open file
            </button>
          </div>

          {mode === "overlay" && primaryBuffer ? (
            <label className="flex items-center gap-3 text-xs text-gray-500">
              Overlay opacity
              <input
                type="range"
                min={0.15}
                max={0.85}
                step={0.05}
                value={overlayOpacity}
                onChange={(event) => setOverlayOpacity(Number(event.target.value))}
                className="h-1.5 w-40 accent-brand-blue"
              />
              <span className="tabular-nums">{Math.round(overlayOpacity * 100)}%</span>
            </label>
          ) : null}

          {mode === "redline" ? (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Tool</span>
              <button
                type="button"
                onClick={() => setRedlineTool("rect")}
                className={[
                  "rounded-md px-2 py-1 font-semibold",
                  redlineTool === "rect" ? "bg-blue-50 text-brand-blue" : "hover:bg-gray-50",
                ].join(" ")}
              >
                Rectangle
              </button>
              <button
                type="button"
                onClick={() => setRedlineTool("pin")}
                className={[
                  "rounded-md px-2 py-1 font-semibold",
                  redlineTool === "pin" ? "bg-blue-50 text-brand-blue" : "hover:bg-gray-50",
                ].join(" ")}
              >
                Pin
              </button>
              <button
                type="button"
                onClick={() => setRedlines([])}
                className="rounded-md px-2 py-1 font-semibold hover:bg-gray-50"
              >
                Clear marks
              </button>
            </div>
          ) : null}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[240px_minmax(0,1fr)_260px]">
          <aside
            ref={versionsRef}
            className={[
              "min-h-0 overflow-y-auto border-b border-gray-100 p-4 lg:border-b-0 lg:border-r",
              highlightVersions ? "ring-2 ring-inset ring-brand-blue/40" : "",
            ].join(" ")}
          >
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Drawing versions</h2>
            {versions.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">No drawings yet. Open a DWG or DXF to start a review.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {versions.map((version) => {
                  const selected = version.id === activeVersion?.id;
                  return (
                    <li key={version.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (activeVersionId && activeVersionId !== version.id) {
                            setCompareVersionId(activeVersionId);
                          }
                          setActiveVersionId(version.id);
                        }}
                        className={[
                          "w-full rounded-xl px-3 py-2.5 text-left transition-colors",
                          selected ? "bg-blue-50 ring-1 ring-brand-blue/20" : "hover:bg-gray-50",
                        ].join(" ")}
                      >
                        <p className="text-sm font-semibold text-brand-navy">{version.name}</p>
                        <p className="mt-0.5 text-[11px] text-gray-500">{version.dateLabel}</p>
                        {version.status === "approved" ? (
                          <span className="mt-1 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            Approved
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <h2 className="mt-6 text-xs font-semibold uppercase tracking-wide text-gray-500">Key changes</h2>
            <ul className="mt-3 space-y-2">
              {keyChanges.map((change) => (
                <li key={change.id} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-0.5">{keyChangeIcon(change.tone)}</span>
                  <span>{change.label}</span>
                </li>
              ))}
            </ul>
          </aside>

          <section
            ref={canvasRef}
            className="relative flex h-full min-h-80 min-w-0 flex-col bg-[#fbfcfe]"
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
          >
            <CadViewerHost
              mode={viewerMode}
              primaryBuffer={primaryBuffer}
              primaryName={activeVersion?.fileName ?? null}
              secondaryBuffer={secondaryBuffer}
              secondaryName={compareVersion?.fileName ?? null}
              overlayOpacity={overlayOpacity}
              emptyState={emptyState}
            />
            {primaryBuffer ? (
              <svg
                className={[
                  "absolute inset-0 z-10 h-full w-full",
                  mode === "redline" ? "cursor-crosshair" : "pointer-events-none",
                ].join(" ")}
                onPointerDown={onRedlinePointerDown}
                onPointerMove={onRedlinePointerMove}
                onPointerUp={onRedlinePointerUp}
              >
                {[...redlines, draftRect].filter(Boolean).map((mark) => {
                  if (!mark) return null;
                  if (mark.kind === "pin") {
                    return (
                      <g key={mark.id}>
                        <circle cx={`${mark.x}%`} cy={`${mark.y}%`} r="7" fill={mark.color} opacity="0.9" />
                        <circle cx={`${mark.x}%`} cy={`${mark.y}%`} r="3" fill="white" />
                      </g>
                    );
                  }
                  return (
                    <rect
                      key={mark.id}
                      x={`${mark.x}%`}
                      y={`${mark.y}%`}
                      width={`${mark.w ?? 0}%`}
                      height={`${mark.h ?? 0}%`}
                      fill={mark.color}
                      fillOpacity="0.18"
                      stroke={mark.color}
                      strokeWidth="1.5"
                    />
                  );
                })}
              </svg>
            ) : null}
          </section>

          <aside className="min-h-0 overflow-y-auto border-t border-gray-100 p-4 lg:border-l lg:border-t-0">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Remarks</h2>
            {remarks.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">No remarks yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {remarks.map((remark) => (
                  <li key={remark.id} className="flex gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-brand-navy">
                      {remark.initials}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-brand-navy">{remark.role}</p>
                      <p className="text-[11px] text-gray-400">{remark.dateLabel}</p>
                      <p className="mt-1 text-sm text-gray-600">{remark.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-gray-100 px-4 py-3 md:px-5">
          <button
            type="button"
            onClick={() => setRevisionOpen(true)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold ${BTN_SECONDARY}`}
          >
            <RotateCcw className="h-4 w-4" />
            Request Revision
          </button>
          <button
            type="button"
            onClick={() => setCommentOpen(true)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold ${BTN_SECONDARY}`}
          >
            <MessageSquare className="h-4 w-4" />
            Comment
          </button>
          <button
            type="button"
            onClick={approveActive}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold ${BTN_PRIMARY}`}
          >
            <Check className="h-4 w-4" />
            Approve
          </button>
        </div>
      </div>

      {projectsLoading ? (
        <div className="pointer-events-none absolute right-6 top-6">
          <Loader2 className="h-4 w-4 animate-spin text-brand-blue" />
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-brand-navy px-4 py-2 text-xs font-medium text-white shadow-lg">
          {toast}
        </div>
      ) : null}

      <Modal open={commentOpen} onClose={() => setCommentOpen(false)} title="Add comment" maxWidth="sm">
        <textarea
          value={commentBody}
          onChange={(event) => setCommentBody(event.target.value)}
          rows={4}
          placeholder="Write a remark for this drawing…"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setCommentOpen(false)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${BTN_SECONDARY}`}>
            Cancel
          </button>
          <button type="button" onClick={() => submitComment("comment")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${BTN_PRIMARY}`}>
            Post comment
          </button>
        </div>
      </Modal>

      <Modal open={revisionOpen} onClose={() => setRevisionOpen(false)} title="Request revision" maxWidth="sm">
        <textarea
          value={commentBody}
          onChange={(event) => setCommentBody(event.target.value)}
          rows={4}
          placeholder="Describe what needs to change…"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setRevisionOpen(false)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${BTN_SECONDARY}`}>
            Cancel
          </button>
          <button type="button" onClick={() => submitComment("revision")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${BTN_PRIMARY}`}>
            Send request
          </button>
        </div>
      </Modal>
    </div>
  );
}
