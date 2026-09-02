"use client";

import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  FileText,
  FolderKanban,
  History,
  Loader2,
  Maximize2,
  MessageSquarePlus,
  Minimize2,
  PanelLeft,
  PanelLeftClose,
  Paperclip,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import CustomSelect from "@/app/components/CustomSelect";
import Button from "@/app/components/ui/Button";
import Modal from "@/app/components/ui/Modal";
import { useDashboardProjects } from "@/app/hooks/useDashboardProjects";
import {
  CHAT_MODELS,
  DEFAULT_CHAT_MODEL,
  parseReasoningEffort,
  parseThinking,
  withServerDefaultModel,
  type ChatModelOption,
  type ReasoningEffort,
} from "@/app/lib/regulationsRag/chatModels";
import { normalizeAuthorities } from "@/app/lib/regulationsRag/regulations";
import { formatFilenames, MAX_PROPOSAL_FILES } from "@/app/lib/regulationsRag/chatStore";
import type {
  AuthorityWithDocuments,
  ChatMessageReaction,
  ComplianceResult,
  RagSource,
  RegulationChatMessage,
  RegulationChatSummary,
} from "@/app/lib/regulationsRag/types";
import {
  filterNonDraftProjects,
  getProjectLabel,
} from "@/app/userdashboard/ownerWorkspaceConsultants";
import AuthorityChips from "./AuthorityChips";
import {
  deleteRegulationChat,
  getRegulationChat,
  listRegulationChats,
  sendRegulationChatTurn,
  setRegulationMessageReaction,
} from "./chatApi";
import ComplianceResultView from "./ComplianceResultView";
import MessageActions from "./MessageActions";
import ModelOptionsBar from "./ModelOptionsBar";

type PlotDetails = {
  planningAuthority?: string;
  ward?: string;
  dpZone?: string;
  majorUseOfPlot?: string;
  grossPlotArea?: string | number;
};

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const HISTORY_VISIBLE_KEY = "regulation-chat-history-visible";
const CHAT_MODEL_KEY = "regulation-chat-model";
const CHAT_REASON_KEY = "regulation-chat-reasoning";
const CHAT_THINKING_KEY = "regulation-chat-thinking";

const SUGGESTIONS = [
  "Analyze this proposal for compliance",
  "What is the maximum FSI for a residential plot?",
  "What are the front and side setback rules?",
  "Parking requirements for a residential building?",
  "When is a fire NOC required?",
];

function getPlotDetails(project: { save_plot_details?: unknown }): PlotDetails {
  const plot = project.save_plot_details;
  if (!plot || typeof plot !== "object") return {};
  return plot as PlotDetails;
}

function getPlanningAuthority(project: { save_plot_details?: unknown }): string {
  return getPlotDetails(project).planningAuthority?.trim() || "";
}

function buildProjectNotes(project: {
  title: string;
  project_info?: { proposalNo?: string; title?: string } | null;
  save_plot_details?: unknown;
}): string {
  const plot = getPlotDetails(project);
  const lines: string[] = [`Project: ${getProjectLabel(project)}`];
  const authority = plot.planningAuthority?.trim();
  if (authority) lines.push(`Planning authority: ${authority}`);
  if (plot.ward?.trim()) lines.push(`Ward: ${plot.ward.trim()}`);
  if (plot.dpZone?.trim()) lines.push(`DP zone: ${plot.dpZone.trim()}`);
  if (plot.majorUseOfPlot?.trim()) {
    lines.push(`Proposed use: ${plot.majorUseOfPlot.trim()}`);
  }
  if (plot.grossPlotArea != null && String(plot.grossPlotArea).trim()) {
    lines.push(`Gross plot area: ${String(plot.grossPlotArea).trim()}`);
  }
  return lines.join("\n");
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function plotPills(plot: PlotDetails) {
  const pills: { label: string; value: string }[] = [];
  if (plot.planningAuthority?.trim()) {
    pills.push({ label: "Authority", value: plot.planningAuthority.trim() });
  }
  if (plot.ward?.trim()) pills.push({ label: "Ward", value: plot.ward.trim() });
  if (plot.dpZone?.trim()) pills.push({ label: "DP zone", value: plot.dpZone.trim() });
  if (plot.majorUseOfPlot?.trim()) {
    pills.push({ label: "Use", value: plot.majorUseOfPlot.trim() });
  }
  if (plot.grossPlotArea != null && String(plot.grossPlotArea).trim()) {
    pills.push({ label: "Area", value: String(plot.grossPlotArea).trim() });
  }
  return pills;
}

function AssistantBody({
  text,
  streaming = false,
  error = false,
}: {
  text: string;
  streaming?: boolean;
  error?: boolean;
}) {
  return (
    <div
      className={[
        "whitespace-pre-wrap wrap-break-word text-[15px] leading-7",
        error ? "text-red-800" : "text-gray-800",
      ].join(" ")}
    >
      {text}
      {streaming ? (
        <span
          className="ml-0.5 inline-block h-[1.15em] w-[2px] animate-pulse bg-brand-blue align-text-bottom"
          aria-hidden
        />
      ) : null}
    </div>
  );
}

function sourceLabel(s: RagSource) {
  const page = s.page != null ? ` · p.${s.page}` : "";
  const auth = s.authority ? `${s.authority} · ` : "";
  return `${auth}${s.source}${page}`;
}

function formatChatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SourceExcerpt({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text.trim()) return null;
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] font-medium text-brand-blue hover:text-brand-navy"
      >
        {open ? "Hide excerpt" : "Show excerpt"}
      </button>
      {open ? (
        <p className="mt-1.5 whitespace-pre-wrap wrap-break-word text-xs leading-relaxed text-gray-600">
          {text}
        </p>
      ) : null}
    </div>
  );
}

function Sources({
  sources,
  fullWidth = false,
}: {
  sources: RagSource[];
  fullWidth?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!sources.length) return null;
  const visible = sources.slice(0, 6);
  return (
    <div
      className={[
        "mt-2",
        fullWidth ? "w-full max-w-full" : "max-w-[min(100%,42rem)]",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-0.5 py-1 text-left hover:bg-slate-50"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Sources
          <span className="ml-1.5 font-normal normal-case tracking-normal">
            {visible.length}
          </span>
        </p>
        <ChevronDown
          className={[
            "h-3.5 w-3.5 text-gray-400 transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>
      {open ? (
        <div className="mt-2 space-y-2">
          {visible.map((s, i) => (
            <div
              key={`${s.source}-${s.page}-${i}`}
              className="rounded-xl border border-gray-100 bg-white px-3 py-2.5"
            >
              <p className="wrap-break-word text-xs font-semibold text-brand-navy">
                {sourceLabel(s)}
              </p>
              {s.snippet ? <SourceExcerpt text={s.snippet} /> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ComplianceClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { projects, loading: projectsLoading } = useDashboardProjects();
  const nonDraftProjects = useMemo(
    () => filterNonDraftProjects(projects),
    [projects]
  );

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<RegulationChatSummary[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [messages, setMessages] = useState<RegulationChatMessage[]>([]);
  const [authorities, setAuthorities] = useState<AuthorityWithDocuments[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<RegulationChatSummary | null>(null);
  const [deletingChat, setDeletingChat] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachedFilename, setAttachedFilename] = useState<string | null>(null);
  const [chatModels, setChatModels] = useState<ChatModelOption[]>(CHAT_MODELS);
  const [chatModel, setChatModel] = useState(DEFAULT_CHAT_MODEL);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>("low");
  const [thinking, setThinking] = useState(false);
  const storedModelRef = useRef<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const nativeFullscreenRef = useRef(false);
  const skipChatLoadRef = useRef(false);
  const streamBufRef = useRef("");
  const streamRafRef = useRef(0);
  const [statusText, setStatusText] = useState("Searching the regulation library…");
  const [streamText, setStreamText] = useState("");
  const [streamCompliance, setStreamCompliance] = useState<ComplianceResult | null>(
    null
  );

  const selectedProject =
    nonDraftProjects.find((p) => p.id === selectedProjectId) ?? null;
  const plot = getPlotDetails(selectedProject ?? {});
  const contextPills = plotPills(plot);
  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;
  const documentName = files[0]?.name || attachedFilename;

  const replaceQuery = useCallback(
    (projectId: string, chatId: string | null) => {
      const params = new URLSearchParams();
      if (projectId) params.set("projectId", projectId);
      if (chatId) params.set("chatId", chatId);
      const qs = params.toString();
      router.replace(qs ? `/userdashboard/compliance?${qs}` : "/userdashboard/compliance", {
        scroll: false,
      });
    },
    [router]
  );

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: streamText || streamCompliance ? "auto" : "smooth",
    });
  }, [messages, busy, streamText, streamCompliance, statusText]);

  useEffect(() => {
    return () => {
      if (streamRafRef.current) cancelAnimationFrame(streamRafRef.current);
    };
  }, []);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(HISTORY_VISIBLE_KEY) === "0") {
        setHistoryVisible(false);
      }
      const storedModel = window.localStorage.getItem(CHAT_MODEL_KEY)?.trim() || "";
      const storedReason = parseReasoningEffort(window.localStorage.getItem(CHAT_REASON_KEY));
      const storedThinking = parseThinking(window.localStorage.getItem(CHAT_THINKING_KEY));
      storedModelRef.current = storedModel || null;
      if (storedModel) setChatModel(storedModel);
      if (storedReason) setReasoningEffort(storedReason);
      if (typeof storedThinking === "boolean") setThinking(storedThinking);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/regulations/health")
      .then((res) => res.json())
      .then((data: { model?: string }) => {
        if (cancelled) return;
        const catalog = withServerDefaultModel(data.model);
        setChatModels(catalog);
        setChatModel((prev) => {
          const stored = storedModelRef.current;
          if (stored && catalog.some((item) => item.id === stored)) return stored;
          const serverModel = data.model?.trim() || "";
          if (serverModel && catalog.some((item) => item.id === serverModel)) {
            return serverModel;
          }
          if (catalog.some((item) => item.id === prev)) return prev;
          return catalog[0]?.id || DEFAULT_CHAT_MODEL;
        });
      })
      .catch(() => {
        /* keep the local catalog */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (projectsLoading || selectedProjectId) return;
    const fromQuery = searchParams.get("projectId")?.trim() || "";
    if (fromQuery && nonDraftProjects.some((p) => p.id === fromQuery)) {
      setSelectedProjectId(fromQuery);
      return;
    }
    if (nonDraftProjects[0]) {
      setSelectedProjectId(nonDraftProjects[0].id);
    }
  }, [searchParams, projectsLoading, nonDraftProjects, selectedProjectId]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/regulations/authorities")
      .then((res) => res.json())
      .then((data: { authorities?: AuthorityWithDocuments[] }) => {
        if (!cancelled) setAuthorities(data.authorities || []);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load authorities.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    const project = nonDraftProjects.find((p) => p.id === selectedProjectId);
    if (!project) return;
    setNotes(buildProjectNotes(project));
    if (!activeChatId) {
      const ids = normalizeAuthorities(getPlanningAuthority(project));
      setSelected(new Set(ids));
    }
  }, [selectedProjectId, nonDraftProjects, activeChatId]);

  useEffect(() => {
    if (!selectedProjectId) {
      setChats([]);
      setActiveChatId(null);
      setMessages([]);
      return;
    }

    let cancelled = false;
    setChatsLoading(true);
    void listRegulationChats(selectedProjectId)
      .then((list) => {
        if (cancelled) return;
        setChats(list);
        const fromQuery = searchParams.get("chatId")?.trim() || "";
        if (fromQuery && list.some((c) => c.id === fromQuery)) {
          setActiveChatId(fromQuery);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load chats.");
        }
      })
      .finally(() => {
        if (!cancelled) setChatsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Only reload when the project changes; chatId query is applied from the fetched list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  function selectProject(projectId: string) {
    if (projectId === selectedProjectId) return;
    setSelectedProjectId(projectId);
    setActiveChatId(null);
    setMessages([]);
    setFiles([]);
    setAttachedFilename(null);
    setError(null);
    setQuestion("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    replaceQuery(projectId, null);
  }

  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      setAttachedFilename(null);
      return;
    }
    if (skipChatLoadRef.current) {
      skipChatLoadRef.current = false;
      return;
    }

    let cancelled = false;
    void getRegulationChat(activeChatId)
      .then(({ chat, messages: next }) => {
        if (cancelled) return;
        setMessages(next);
        setAttachedFilename(chat.document_filename);
        if (chat.authorities.length) setSelected(new Set(chat.authorities));
        setChats((prev) => {
          const rest = prev.filter((c) => c.id !== chat.id);
          return [chat, ...rest].sort(
            (a, b) => +new Date(b.updated_at) - +new Date(a.updated_at)
          );
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load chat.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeChatId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setDesktopHistoryVisible(next: boolean) {
    setHistoryVisible(next);
    try {
      window.localStorage.setItem(HISTORY_VISIBLE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  const setFullscreenMode = useCallback(async (next: boolean) => {
    setFullscreen(next);
    if (next) {
      try {
        await rootRef.current?.requestFullscreen();
        nativeFullscreenRef.current = document.fullscreenElement === rootRef.current;
      } catch {
        nativeFullscreenRef.current = false;
      }
      return;
    }
    nativeFullscreenRef.current = false;
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        /* overlay state is already cleared */
      }
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (document.fullscreenElement === rootRef.current) {
        nativeFullscreenRef.current = true;
        setFullscreen(true);
        return;
      }
      if (!document.fullscreenElement && nativeFullscreenRef.current) {
        nativeFullscreenRef.current = false;
        setFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.fullscreenElement) return;
      void setFullscreenMode(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen, setFullscreenMode]);

  const chatFullWidth = fullscreen || !historyVisible;

  function startNewChat() {
    setActiveChatId(null);
    setMessages([]);
    setFiles([]);
    setAttachedFilename(null);
    setQuestion("");
    setError(null);
    setHistoryOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    const project = nonDraftProjects.find((p) => p.id === selectedProjectId);
    if (project) {
      setSelected(new Set(normalizeAuthorities(getPlanningAuthority(project))));
    }
    if (selectedProjectId) replaceQuery(selectedProjectId, null);
    inputRef.current?.focus();
  }

  function acceptFiles(list: FileList | File[] | null | undefined) {
    if (!list?.length) return;
    const incoming = Array.from(list);
    const rejected = incoming.filter(
      (next) =>
        next.type !== "application/pdf" && !next.name.toLowerCase().endsWith(".pdf")
    );
    if (rejected.length) {
      setError("Please upload PDF files only.");
      return;
    }
    const oversized = incoming.find((next) => next.size > MAX_PDF_BYTES);
    if (oversized) {
      setError(`${oversized.name} must be 25 MB or smaller.`);
      return;
    }
    let tooMany = false;
    setFiles((prev) => {
      const next = [...prev];
      for (const file of incoming) {
        if (next.some((existing) => existing.name === file.name && existing.size === file.size)) {
          continue;
        }
        if (next.length >= MAX_PROPOSAL_FILES) {
          tooMany = true;
          break;
        }
        next.push(file);
      }
      return next;
    });
    setError(tooMany ? `You can attach up to ${MAX_PROPOSAL_FILES} PDFs.` : null);
  }

  async function send(text = question) {
    if (!selectedProjectId || busy) return;
    const trimmed = text.trim();
    if (!trimmed && files.length === 0) return;

    const pendingFiles = files;
    const pendingLabel = formatFilenames(pendingFiles.map((f) => f.name));
    setBusy(true);
    setError(null);
    streamBufRef.current = "";
    setStreamText("");
    setStreamCompliance(null);
    setStatusText(
      pendingFiles.length || /complian|analy[sz]e|gap analysis/i.test(trimmed)
        ? "Matching your proposal to regulations…"
        : "Searching the regulation library…"
    );
    setQuestion("");
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        chat_id: activeChatId || "local",
        role: "user",
        content:
          trimmed ||
          `Analyze this proposal for compliance (${pendingLabel || "PDF"})`,
        kind: pendingFiles.length ? "document" : "text",
        sources: [],
        compliance: null,
        filename: pendingLabel || null,
        error: false,
        reaction: null,
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      const result = await sendRegulationChatTurn(
        {
          projectId: selectedProjectId,
          chatId: activeChatId || undefined,
          question: trimmed,
          files: pendingFiles,
          authorities: [...selected],
          notes,
          model: chatModel,
          reasoningEffort,
          thinking,
        },
        {
          onStatus: setStatusText,
          onToken: (text) => {
            streamBufRef.current += text;
            if (streamRafRef.current) return;
            streamRafRef.current = requestAnimationFrame(() => {
              streamRafRef.current = 0;
              setStreamText(streamBufRef.current);
            });
          },
          onCompliance: (data) => {
            setStreamCompliance((prev) => ({
              ...data,
              sources: data.sources?.length ? data.sources : prev?.sources || [],
              summary: streamBufRef.current || data.summary,
            }));
          },
        }
      );

      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      skipChatLoadRef.current = true;
      setActiveChatId(result.chat.id);
      setMessages(result.messages);
      setAttachedFilename(result.chat.document_filename);
      setChats((prev) => {
        const rest = prev.filter((c) => c.id !== result.chat.id);
        return [result.chat, ...rest];
      });
      replaceQuery(selectedProjectId, result.chat.id);

      const detection = result.assistantMessage.compliance?.detection?.detected;
      if (detection?.length && selected.size === 0) {
        setSelected(new Set(detection));
      }
    } catch (err) {
      setQuestion(trimmed);
      setMessages((prev) => prev.filter((m) => !m.id.startsWith("local-")));
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      if (streamRafRef.current) {
        cancelAnimationFrame(streamRafRef.current);
        streamRafRef.current = 0;
      }
      streamBufRef.current = "";
      setStreamText("");
      setStreamCompliance(null);
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  async function confirmDeleteChat() {
    if (!chatToDelete || deletingChat) return;
    const chatId = chatToDelete.id;
    setDeletingChat(true);
    try {
      await deleteRegulationChat(chatId);
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      setChatToDelete(null);
      if (activeChatId === chatId) startNewChat();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete chat.");
    } finally {
      setDeletingChat(false);
    }
  }

  async function reactToMessage(
    messageId: string,
    reaction: ChatMessageReaction | null
  ) {
    if (messageId.startsWith("local-")) return;
    const previous = messages.find((m) => m.id === messageId)?.reaction ?? null;
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, reaction } : m))
    );
    try {
      const updated = await setRegulationMessageReaction(messageId, reaction);
      setMessages((prev) =>
        prev.map((m) => (m.id === updated.id ? { ...m, reaction: updated.reaction } : m))
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reaction: previous } : m))
      );
      setError(err instanceof Error ? err.message : "Could not save reaction.");
    }
  }

  const canSend = Boolean(selectedProjectId) && !busy && Boolean(question.trim() || files.length);

  const historyList = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          History
        </p>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={startNewChat}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-blue hover:bg-blue-50"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            New
          </button>
          <button
            type="button"
            onClick={() => void setFullscreenMode(!fullscreen)}
            aria-pressed={fullscreen}
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className={[
              "rounded-lg p-1",
              fullscreen
                ? "bg-blue-50 text-brand-navy"
                : "text-gray-400 hover:bg-gray-50 hover:text-gray-700",
            ].join(" ")}
          >
            {fullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            aria-label="Hide history"
            onClick={() => {
              setDesktopHistoryVisible(false);
              setHistoryOpen(false);
            }}
            className="hidden rounded-lg p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-700 lg:inline-flex"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {chatsLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-gray-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-brand-blue" />
            Loading…
          </div>
        ) : chats.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-gray-400">
            No saved chats for this project yet.
          </p>
        ) : (
          <ul className="space-y-1">
            {chats.map((chat) => {
              const active = chat.id === activeChatId;
              return (
                <li key={chat.id}>
                  <div
                    className={[
                      "group flex items-start gap-1 rounded-xl px-2 py-2",
                      active ? "bg-blue-50" : "hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveChatId(chat.id);
                        setHistoryOpen(false);
                        if (selectedProjectId) replaceQuery(selectedProjectId, chat.id);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p
                        className={[
                          "truncate text-sm font-medium",
                          active ? "text-brand-navy" : "text-gray-800",
                        ].join(" ")}
                      >
                        {chat.title}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-gray-400">
                        {chat.document_filename
                          ? chat.document_filename
                          : formatChatTime(chat.updated_at)}
                      </p>
                    </button>
                    <button
                      type="button"
                      aria-label="Delete chat"
                      onClick={() => setChatToDelete(chat)}
                      className="rounded-md p-1 text-gray-300 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={[
        "flex min-h-0 w-full flex-col overflow-hidden bg-white",
        fullscreen
          ? "fixed inset-0 z-[80] h-dvh"
          : "h-[calc(100dvh-4rem)]",
      ].join(" ")}
    >
      <div className="relative z-20 shrink-0 border-b border-gray-100 bg-white px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setHistoryOpen((open) => !open)}
              aria-pressed={historyOpen}
              aria-label={historyOpen ? "Hide chat history" : "Show chat history"}
              className={[
                "inline-flex h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold lg:hidden",
                historyOpen
                  ? "border-brand-blue/40 bg-blue-50 text-brand-navy"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-slate-50",
              ].join(" ")}
            >
              <History className="h-4 w-4" />
            </button>
            <div className="flex min-w-0 items-start gap-3">
              <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-brand-blue sm:flex">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-brand-navy sm:text-lg">
                  Regulation chat
                </h1>
                {fullscreen ? (
                  <p className="mt-0.5 text-sm text-gray-500">
                    Fullscreen · Esc to exit
                  </p>
                ) : (
                  <p className="mt-0.5 hidden text-sm text-gray-500 sm:block">
                    Ask CIDCO, MIDC, SRA &amp; MCGM, or upload proposal PDFs to check
                    compliance.
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="min-w-0 lg:w-80 lg:flex-none">
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
              <FolderKanban className="h-3.5 w-3.5" />
              Project
            </label>
            <CustomSelect
              value={selectedProjectId}
              onChange={selectProject}
              options={
                projectsLoading
                  ? []
                  : nonDraftProjects.map((project) => ({
                      value: project.id,
                      label: getProjectLabel(project),
                    }))
              }
              placeholder={
                projectsLoading
                  ? "Loading projects…"
                  : nonDraftProjects.length === 0
                    ? "No submitted projects"
                    : "Select a project"
              }
              disabled={projectsLoading || nonDraftProjects.length === 0}
            />
          </div>
        </div>
        {contextPills.length > 0 ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {contextPills.map((pill) => (
              <span
                key={pill.label}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600"
              >
                <span className="font-medium text-gray-400">{pill.label}</span>
                <span className="font-semibold text-brand-navy">{pill.value}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1">
        <aside
          className={[
            "hidden shrink-0 flex-col border-r border-gray-100 bg-white transition-[width] duration-200 lg:flex",
            historyVisible ? "w-72" : "w-12",
          ].join(" ")}
        >
          {historyVisible ? (
            historyList
          ) : (
            <div className="flex flex-col items-center gap-1 py-3">
              <button
                type="button"
                aria-label="Show chat history"
                onClick={() => setDesktopHistoryVisible(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-blue-50 hover:text-brand-navy"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="New chat"
                onClick={startNewChat}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-blue-50 hover:text-brand-navy"
              >
                <MessageSquarePlus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void setFullscreenMode(!fullscreen)}
                aria-pressed={fullscreen}
                aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                className={[
                  "inline-flex h-9 w-9 items-center justify-center rounded-lg",
                  fullscreen
                    ? "bg-blue-50 text-brand-navy"
                    : "text-gray-500 hover:bg-blue-50 hover:text-brand-navy",
                ].join(" ")}
              >
                {fullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>
            </div>
          )}
        </aside>

        {historyOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Close history"
              className="absolute inset-0 bg-black/30"
              onClick={() => setHistoryOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 flex w-[min(20rem,90vw)] flex-col bg-white">
              <div className="flex items-center justify-between border-b border-gray-100 px-3 py-3">
                <p className="text-sm font-semibold text-brand-navy">Chat history</p>
                <button
                  type="button"
                  onClick={() => setHistoryOpen(false)}
                  className="rounded-lg p-1 text-gray-500 hover:bg-gray-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {historyList}
            </div>
          </div>
        ) : null}

        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface">
          <div
            ref={scrollerRef}
            className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6"
          >
            {messages.length === 0 && !busy ? (
              <div className="mx-auto flex max-w-lg flex-col items-center px-2 py-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-brand-blue">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-brand-navy">
                  Ask, or check a proposal
                </p>
                <p className="mt-1 text-sm leading-relaxed text-gray-500">
                  Upload PDFs to run a compliance check and ask follow-up questions
                  about the documents. Without files, answers come from the
                  regulation library.
                </p>
                <div className="mt-5 flex w-full flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={!selectedProjectId || busy}
                      onClick={() => {
                        if (s.startsWith("Analyze") && files.length === 0 && !attachedFilename) {
                          fileInputRef.current?.click();
                          setQuestion(s);
                          return;
                        }
                        void send(s);
                      }}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-left text-xs font-medium text-gray-700 transition-colors hover:border-brand-blue/40 hover:bg-blue-50 hover:text-brand-navy disabled:opacity-50"
                    >
                      <Sparkles className="h-3 w-3 shrink-0 text-brand-blue" />
                      <span className="truncate">{s}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div
                className={[
                  "mx-auto flex w-full flex-col gap-4",
                  chatFullWidth ? "max-w-none" : "max-w-3xl",
                ].join(" ")}
              >
                {activeChat?.document_filename || attachedFilename ? (
                  <div className="inline-flex max-w-full items-center gap-2 self-start rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-brand-blue" />
                    <span className="truncate font-medium">
                      {activeChat?.document_filename || attachedFilename}
                    </span>
                    {activeChat?.document_pages ? (
                      <span className="text-gray-400">
                        · {activeChat.document_pages} pages
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {messages.map((m) => (
                  <div key={m.id} className="flex flex-col gap-2">
                    {m.role === "user" ? (
                      <article className="ml-auto max-w-[92%] rounded-2xl rounded-br-md bg-brand-blue px-3.5 py-2.5 text-sm leading-relaxed text-white sm:max-w-[80%]">
                        {m.filename ? (
                          <p className="mb-1 flex items-center gap-1.5 text-xs text-blue-100">
                            <Paperclip className="h-3 w-3" />
                            {m.filename}
                          </p>
                        ) : null}
                        <p className="whitespace-pre-wrap wrap-break-word">{m.content}</p>
                      </article>
                    ) : m.kind === "compliance" && m.compliance && !m.error ? (
                      <div className="w-full max-w-full rounded-2xl rounded-bl-md border border-gray-100 bg-white p-4 sm:p-5">
                        <ComplianceResultView data={m.compliance} />
                      </div>
                    ) : (
                      <article
                        className={[
                          "rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm leading-relaxed",
                          chatFullWidth
                            ? "w-full max-w-full"
                            : "max-w-[92%] sm:max-w-[80%]",
                          m.error ? "bg-red-50 text-red-800" : "bg-white text-gray-800",
                        ].join(" ")}
                      >
                        <AssistantBody text={m.content} error={m.error} />
                      </article>
                    )}
                    {m.role === "assistant" && m.kind !== "compliance" && m.sources?.length ? (
                      <Sources sources={m.sources} fullWidth={chatFullWidth} />
                    ) : null}
                    {!m.id.startsWith("local-") && m.role === "assistant" ? (
                      <div
                        className={
                          chatFullWidth
                            ? "w-full max-w-full"
                            : "max-w-[92%] sm:max-w-[80%]"
                        }
                      >
                        <MessageActions
                          message={m}
                          onReact={(reaction) => void reactToMessage(m.id, reaction)}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}

                {busy && messages[messages.length - 1]?.role !== "assistant" ? (
                  streamCompliance ? (
                    <div className="w-full max-w-full rounded-2xl rounded-bl-md border border-gray-100 bg-white p-4 sm:p-5">
                      <ComplianceResultView
                        data={{
                          ...streamCompliance,
                          summary: streamText || streamCompliance.summary,
                        }}
                        streaming
                      />
                    </div>
                  ) : (
                    <article
                      className={[
                        "rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm leading-relaxed",
                        chatFullWidth
                          ? "w-full max-w-full"
                          : "max-w-[92%] sm:max-w-[80%]",
                        streamText ? "text-gray-800" : "text-gray-500",
                      ].join(" ")}
                    >
                      {streamText ? (
                        <AssistantBody text={streamText} streaming />
                      ) : (
                        <p className="flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-blue" />
                          {statusText}
                        </p>
                      )}
                    </article>
                  )
                ) : null}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 sm:px-6">
            {error ? (
              <div className="mb-3 wrap-break-word rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            <div className="mb-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Authorities{" "}
                <span className="font-normal normal-case tracking-normal text-gray-400">
                  {getPlanningAuthority(selectedProject ?? {})
                    ? "pre-filled from the project"
                    : "optional — leave empty to auto-detect"}
                </span>
              </p>
              <AuthorityChips
                compact
                authorities={authorities}
                selected={selected}
                onToggle={toggle}
              />
            </div>

            <form onSubmit={onSubmit}>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                multiple
                disabled={!selectedProjectId || busy}
                className="sr-only"
                onChange={(e) => {
                  acceptFiles(e.target.files);
                  e.target.value = "";
                }}
              />

              {files.length ? (
                <div className="mb-2 flex flex-wrap gap-2">
                  {files.map((item) => (
                    <div
                      key={`${item.name}-${item.size}-${item.lastModified}`}
                      className="inline-flex max-w-full items-center gap-2 rounded-full border border-brand-blue/30 bg-blue-50 px-3 py-1.5 text-xs text-brand-navy"
                    >
                      <Paperclip className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate font-medium">{item.name}</span>
                      <span className="text-gray-500">{formatFileSize(item.size)}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${item.name}`}
                        onClick={() => {
                          setFiles((prev) =>
                            prev.filter(
                              (f) =>
                                !(
                                  f.name === item.name &&
                                  f.size === item.size &&
                                  f.lastModified === item.lastModified
                                )
                            )
                          );
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="rounded-full p-0.5 hover:bg-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-2 focus-within:border-brand-blue focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-blue/20">
                <button
                  type="button"
                  disabled={!selectedProjectId || busy}
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach PDFs"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 hover:text-brand-navy disabled:opacity-40"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <textarea
                  ref={inputRef}
                  id="regulation-question"
                  rows={2}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={
                    !selectedProjectId
                      ? "Select a project first"
                      : documentName
                        ? files.length > 1
                          ? `Ask about these ${files.length} documents, or send to run a compliance check`
                          : "Ask about this document, or send to run a compliance check"
                        : "Ask about FSI, setbacks, parking… or attach PDFs"
                  }
                  disabled={!selectedProjectId}
                  className="max-h-32 min-h-11 w-full resize-none bg-transparent px-1 py-2 text-base text-gray-900 outline-none placeholder:text-gray-400 sm:text-sm"
                />
                <button
                  type="submit"
                  disabled={!canSend}
                  aria-label="Send"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-blue text-white shadow-sm transition-all hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
              <ModelOptionsBar
                model={chatModel}
                reasoningEffort={reasoningEffort}
                thinking={thinking}
                models={chatModels}
                disabled={!selectedProjectId || busy}
                onModelChange={(id) => {
                  storedModelRef.current = id;
                  setChatModel(id);
                  try {
                    window.localStorage.setItem(CHAT_MODEL_KEY, id);
                  } catch {
                    /* ignore */
                  }
                }}
                onReasoningChange={(effort) => {
                  setReasoningEffort(effort);
                  try {
                    window.localStorage.setItem(CHAT_REASON_KEY, effort);
                  } catch {
                    /* ignore */
                  }
                }}
                onThinkingChange={(next) => {
                  setThinking(next);
                  try {
                    window.localStorage.setItem(CHAT_THINKING_KEY, next ? "on" : "off");
                  } catch {
                    /* ignore */
                  }
                }}
              />
              <p className="mt-2 px-1 text-[11px] text-gray-400">
                Enter to send · Shift+Enter for a new line · up to {MAX_PROPOSAL_FILES} PDFs, 25 MB each
              </p>
            </form>
          </div>
        </section>
      </div>

      <Modal
        open={Boolean(chatToDelete)}
        onClose={() => {
          if (!deletingChat) setChatToDelete(null);
        }}
        title="Delete chat?"
        maxWidth="sm"
      >
        <p className="text-sm leading-relaxed text-gray-600">
          This will permanently delete{" "}
          <span className="font-semibold text-brand-navy">
            {chatToDelete?.title || "this chat"}
          </span>{" "}
          and its messages. This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={deletingChat}
            onClick={() => setChatToDelete(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={deletingChat}
            onClick={() => void confirmDeleteChat()}
          >
            {deletingChat ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting…
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
