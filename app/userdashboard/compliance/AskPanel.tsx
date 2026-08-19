"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { BookOpen, Loader2, Send, Sparkles } from "lucide-react";
import { Card } from "@/app/components/ui/Card";
import type { AskResult, RagSource } from "@/app/lib/regulationsRag/types";
import AuthorityChips from "./AuthorityChips";

type AuthorityChip = {
  id: string;
  label: string;
  description?: string;
};

type ChatMessage = {
  role: "user" | "bot";
  text: string;
  sources?: RagSource[];
  error?: boolean;
};

const SUGGESTIONS = [
  "What is the maximum FSI for a residential plot?",
  "What are the front and side setback rules?",
  "Parking requirements for a residential building?",
  "When is a fire NOC required?",
];

function Sources({
  sources,
  inverted,
}: {
  sources: RagSource[];
  inverted?: boolean;
}) {
  if (!sources.length) return null;
  return (
    <div className="mt-2.5 space-y-1 border-t border-current/10 pt-2">
      <p
        className={[
          "text-[11px] font-semibold uppercase tracking-wide",
          inverted ? "text-white/70" : "text-gray-400",
        ].join(" ")}
      >
        Sources
      </p>
      {sources.map((s, i) => {
        const page = s.page != null ? ` · p.${s.page}` : "";
        const auth = s.authority ? `${s.authority} · ` : "";
        return (
          <p
            key={`${s.source}-${s.page}-${i}`}
            className={[
              "wrap-break-word text-xs leading-relaxed",
              inverted ? "text-white/80" : "text-gray-500",
            ].join(" ")}
          >
            {auth}
            {s.source}
            {page}
          </p>
        );
      })}
    </div>
  );
}

export default function AskPanel({
  authorities,
  selected,
  onToggle,
}: {
  authorities: AuthorityChip[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function ask(q: string) {
    const text = q.trim();
    if (!text || busy) return;

    setQuestion("");
    setBusy(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", text },
      { role: "bot", text: "Searching the regulation library…" },
    ]);

    try {
      const res = await fetch("/api/regulations/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          authorities: [...selected],
        }),
      });
      const data = (await res.json()) as AskResult & { error?: string };
      if (!res.ok) throw new Error(data.error || "Request failed");

      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "bot",
          text: data.answer,
          sources: data.sources,
        };
        return next;
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "bot", text: message, error: true };
        return next;
      });
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(question);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <Card padding="none" className="p-4 sm:p-5">
        <p className="mb-2.5 text-sm font-medium text-gray-700">
          Filter authorities{" "}
          <span className="font-normal text-gray-400">(optional)</span>
        </p>
        <AuthorityChips
          authorities={authorities}
          selected={selected}
          onToggle={onToggle}
        />
      </Card>

      <Card
        padding="none"
        className="flex min-h-[min(28rem,calc(100dvh-16rem))] flex-col overflow-hidden sm:min-h-[min(36rem,calc(100dvh-14rem))]"
      >
        <div
          ref={scrollerRef}
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 sm:p-5"
        >
          {messages.length === 0 ? (
            <div className="m-auto flex max-w-md flex-col items-center px-2 py-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-brand-blue">
                <BookOpen className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-brand-navy">
                Ask the regulation library
              </p>
              <p className="mt-1 text-sm leading-relaxed text-gray-500">
                Get cited answers from CIDCO, MIDC, SRA, MCGM, and UDCPR
                documents.
              </p>
              <div className="mt-5 flex w-full flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void ask(s)}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-left text-xs font-medium text-gray-700 transition-colors hover:border-brand-blue/40 hover:bg-blue-50 hover:text-brand-navy"
                  >
                    <Sparkles className="h-3 w-3 shrink-0 text-brand-blue" />
                    <span className="truncate">{s}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <article
                key={i}
                className={[
                  "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed sm:max-w-[80%]",
                  m.role === "user"
                    ? "ml-auto rounded-br-md bg-brand-blue text-white"
                    : m.error
                      ? "rounded-bl-md bg-red-50 text-red-800"
                      : "rounded-bl-md bg-slate-50 text-gray-800",
                ].join(" ")}
              >
                {m.role === "bot" &&
                m.text === "Searching the regulation library…" ? (
                  <p className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {m.text}
                  </p>
                ) : (
                  <p className="whitespace-pre-wrap wrap-break-word">{m.text}</p>
                )}
                {m.sources?.length ? (
                  <Sources sources={m.sources} inverted={m.role === "user"} />
                ) : null}
              </article>
            ))
          )}
        </div>

        <form
          onSubmit={onSubmit}
          className="border-t border-gray-100 bg-white p-3 sm:p-4"
        >
          <label className="sr-only" htmlFor="regulation-question">
            Your question
          </label>
          <div className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-2 focus-within:border-brand-blue focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-blue/20">
            <textarea
              ref={inputRef}
              id="regulation-question"
              rows={2}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask about FSI, setbacks, parking…"
              className="max-h-32 min-h-11 w-full resize-none bg-transparent px-2 py-2 text-base text-gray-900 outline-none placeholder:text-gray-400 sm:text-sm"
              required
            />
            <button
              type="submit"
              disabled={busy || !question.trim()}
              aria-label="Ask"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-blue text-white shadow-sm transition-all hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="mt-2 px-1 text-[11px] text-gray-400">
            Enter to send · Shift+Enter for a new line
          </p>
        </form>
      </Card>
    </div>
  );
}
