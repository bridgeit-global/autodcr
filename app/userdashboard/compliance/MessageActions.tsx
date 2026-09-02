"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, Share2, ThumbsDown, ThumbsUp } from "lucide-react";
import type {
  ChatMessageReaction,
  RegulationChatMessage,
} from "@/app/lib/regulationsRag/types";
import { getChatModel } from "@/app/lib/regulationsRag/chatModels";

function messagePlainText(message: RegulationChatMessage) {
  if (message.kind === "compliance" && message.compliance) {
    const data = message.compliance;
    const lines: string[] = [];
    if (data.authorityLabels || data.authorities?.length) {
      lines.push(data.authorityLabels || data.authorities.join(", "));
    }
    if (data.summary) lines.push(data.summary);
    if (data.gaps?.length) {
      lines.push("", "Gaps:");
      for (const gap of data.gaps) {
        lines.push(`- ${gap.title || "Gap"}: ${gap.detail || ""}`.trim());
      }
    }
    if (data.checklist?.length) {
      lines.push("", "Checklist:");
      for (const item of data.checklist) {
        lines.push(
          `- [${item.status || "unclear"}] ${item.requirement || ""}`.trim()
        );
      }
    }
    return lines.filter((line) => line !== undefined).join("\n").trim();
  }
  const attached = message.filename ? `${message.filename}\n` : "";
  return `${attached}${message.content}`.trim();
}

const popTransition = { duration: 0.45, ease: "easeOut" as const };

function modelLabel(id: string | null) {
  if (!id) return null;
  return getChatModel(id)?.label || id.split("/").pop() || id;
}

function formatTokens(n: number) {
  return new Intl.NumberFormat().format(n);
}

function usageLabel(message: RegulationChatMessage) {
  const model = modelLabel(message.model);
  const total =
    message.totalTokens != null ? `${formatTokens(message.totalTokens)} tokens` : null;
  const text = [model, total].filter(Boolean).join(" · ");
  if (!text) return null;
  const parts: string[] = [];
  if (message.promptTokens != null) parts.push(`${formatTokens(message.promptTokens)} prompt`);
  if (message.completionTokens != null) {
    parts.push(`${formatTokens(message.completionTokens)} completion`);
  }
  return { text, title: parts.length ? parts.join(" · ") : text };
}

export default function MessageActions({
  message,
  align = "start",
  onReact,
}: {
  message: RegulationChatMessage;
  align?: "start" | "end";
  onReact: (reaction: ChatMessageReaction | null) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pop, setPop] = useState<ChatMessageReaction | null>(null);

  const liked = message.reaction === "like";
  const unliked = message.reaction === "unlike";

  async function copyText() {
    const text = messagePlainText(message);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setStatus("Copied");
      window.setTimeout(() => {
        setCopied(false);
        setStatus(null);
      }, 1600);
    } catch {
      setStatus("Could not copy");
      window.setTimeout(() => setStatus(null), 1600);
    }
  }

  async function shareText() {
    const text = messagePlainText(message);
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Regulation chat",
          text,
          url,
        });
        setStatus("Shared");
        window.setTimeout(() => setStatus(null), 1600);
        return;
      }
      await navigator.clipboard.writeText(url ? `${text}\n\n${url}` : text);
      setCopied(true);
      setStatus("Link copied");
      window.setTimeout(() => {
        setCopied(false);
        setStatus(null);
      }, 1600);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setStatus("Could not share");
      window.setTimeout(() => setStatus(null), 1600);
    }
  }

  function toggle(next: ChatMessageReaction) {
    const turningOn = message.reaction !== next;
    setPop(turningOn ? next : null);
    onReact(turningOn ? next : null);
  }

  const usage = usageLabel(message);
  const btn =
    "inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-700 transition-colors hover:bg-slate-100 hover:text-gray-900";

  return (
    <div
      className={[
        "flex flex-wrap items-center gap-1",
        align === "end" ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      <motion.button
        type="button"
        aria-label="Like"
        aria-pressed={liked}
        onClick={() => toggle("like")}
        whileTap={{ scale: 0.88 }}
        animate={
          pop === "like"
            ? { scale: [1, 1.35, 0.9, 1.12, 1], rotate: [0, -14, 10, -5, 0] }
            : { scale: 1, rotate: 0 }
        }
        transition={popTransition}
        onAnimationComplete={() => {
          if (pop === "like") setPop(null);
        }}
        className={[
          "inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
          liked
            ? "bg-blue-50 text-brand-blue hover:bg-blue-100"
            : "text-gray-700 hover:bg-slate-100 hover:text-gray-900",
        ].join(" ")}
      >
        <ThumbsUp
          className="h-[18px] w-[18px]"
          strokeWidth={liked ? 1.75 : 2.5}
          fill={liked ? "#2563eb" : "none"}
          stroke={liked ? "#2563eb" : "currentColor"}
        />
      </motion.button>
      <motion.button
        type="button"
        aria-label="Unlike"
        aria-pressed={unliked}
        onClick={() => toggle("unlike")}
        whileTap={{ scale: 0.88 }}
        animate={
          pop === "unlike"
            ? { scale: [1, 1.35, 0.9, 1.12, 1], rotate: [0, 14, -10, 5, 0] }
            : { scale: 1, rotate: 0 }
        }
        transition={popTransition}
        onAnimationComplete={() => {
          if (pop === "unlike") setPop(null);
        }}
        className={[
          "inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
          unliked
            ? "bg-red-50 text-red-500 hover:bg-red-100"
            : "text-gray-700 hover:bg-slate-100 hover:text-gray-900",
        ].join(" ")}
      >
        <ThumbsDown
          className="h-[18px] w-[18px]"
          strokeWidth={unliked ? 1.75 : 2.5}
          fill={unliked ? "currentColor" : "none"}
        />
      </motion.button>
      <button
        type="button"
        aria-label="Copy text"
        onClick={() => void copyText()}
        className={btn}
      >
        {copied ? (
          <Check className="h-[18px] w-[18px] text-brand-blue" strokeWidth={2.5} />
        ) : (
          <Copy className="h-[18px] w-[18px]" strokeWidth={2.5} />
        )}
      </button>
      <button
        type="button"
        aria-label="Share"
        onClick={() => void shareText()}
        className={btn}
      >
        <Share2 className="h-[18px] w-[18px]" strokeWidth={2.5} />
      </button>
      {status ? (
        <span className="ml-1 text-[11px] font-medium text-gray-500">{status}</span>
      ) : null}
      {usage ? (
        <span
          title={usage.title}
          className="ml-1.5 text-[11px] font-medium text-gray-400"
        >
          {usage.text}
        </span>
      ) : null}
    </div>
  );
}
