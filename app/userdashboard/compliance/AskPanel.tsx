"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import Button from "@/app/components/ui/Button";
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

function Sources({ sources, inverted }: { sources: RagSource[]; inverted?: boolean }) {
  if (!sources.length) return null;
  return (
    <div className="mt-2 space-y-1">
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
              "wrap-break-word text-xs",
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
  const [hint, setHint] = useState("Ask a question about indexed regulations.");
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || busy) return;

    setQuestion("");
    setBusy(true);
    setHint("Searching documents…");
    setMessages((prev) => [
      ...prev,
      { role: "user", text: q },
      { role: "bot", text: "Thinking…" },
    ]);

    try {
      const res = await fetch("/api/regulations/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
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
      setHint("Done");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "bot", text: message, error: true };
        return next;
      });
      setHint("Error");
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-3 sm:gap-4">
      <div>
        <p className="mb-1.5 text-sm font-medium text-gray-700">
          Filter authorities{" "}
          <span className="font-normal text-gray-400">(optional)</span>
        </p>
        <AuthorityChips
          authorities={authorities}
          selected={selected}
          onToggle={onToggle}
        />
      </div>

      <Card
        padding="none"
        className="flex min-h-[min(28rem,calc(100dvh-18rem))] flex-col sm:min-h-[360px]"
      >
        <div
          ref={scrollerRef}
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 sm:p-4"
        >
          {messages.length === 0 ? (
            <p className="m-auto px-4 text-center text-sm text-gray-400">
              Ask a question about indexed regulations.
            </p>
          ) : (
            messages.map((m, i) => (
              <article
                key={i}
                className={[
                  "max-w-[92%] rounded-xl px-3 py-2.5 text-sm leading-relaxed sm:max-w-[85%] sm:px-3.5",
                  m.role === "user"
                    ? "ml-auto bg-brand-blue text-white"
                    : m.error
                      ? "bg-red-50 text-red-800"
                      : "bg-gray-50 text-gray-800",
                ].join(" ")}
              >
                <p className="whitespace-pre-wrap wrap-break-word">{m.text}</p>
                {m.sources?.length ? (
                  <Sources sources={m.sources} inverted={m.role === "user"} />
                ) : null}
              </article>
            ))
          )}
        </div>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-2 border-t border-gray-100 p-3 sm:flex-row sm:items-end"
        >
          <label className="sr-only" htmlFor="regulation-question">
            Your question
          </label>
          <textarea
            id="regulation-question"
            rows={2}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="e.g. What are the FSI rules under CIDCO GDR?"
            className="min-h-11 w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20 sm:text-sm"
            required
          />
          <Button
            type="submit"
            disabled={busy || !question.trim()}
            className="w-full shrink-0 sm:w-auto"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="ml-1.5">Ask</span>
          </Button>
        </form>
      </Card>
      <p className="text-xs text-gray-400">{hint}</p>
    </div>
  );
}
