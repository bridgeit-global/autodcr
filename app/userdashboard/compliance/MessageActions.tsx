"use client";

import { useState } from "react";
import { Check, Copy, Share2, ThumbsDown, ThumbsUp } from "lucide-react";
import type {
  ChatMessageReaction,
  RegulationChatMessage,
} from "@/app/lib/regulationsRag/types";

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
    onReact(message.reaction === next ? null : next);
  }

  const btn =
    "inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-slate-100 hover:text-brand-navy";

  return (
    <div
      className={[
        "flex items-center gap-0.5",
        align === "end" ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      <button
        type="button"
        aria-label="Like"
        aria-pressed={message.reaction === "like"}
        onClick={() => toggle("like")}
        className={[
          btn,
          message.reaction === "like" ? "bg-blue-50 text-brand-blue" : "",
        ].join(" ")}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Unlike"
        aria-pressed={message.reaction === "unlike"}
        onClick={() => toggle("unlike")}
        className={[
          btn,
          message.reaction === "unlike" ? "bg-red-50 text-red-600" : "",
        ].join(" ")}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Copy text"
        onClick={() => void copyText()}
        className={btn}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-brand-blue" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        aria-label="Share"
        onClick={() => void shareText()}
        className={btn}
      >
        <Share2 className="h-3.5 w-3.5" />
      </button>
      {status ? (
        <span className="ml-1 text-[11px] font-medium text-gray-400">{status}</span>
      ) : null}
    </div>
  );
}
