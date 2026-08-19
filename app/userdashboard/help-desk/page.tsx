"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ChevronDown, CircleHelp, LifeBuoy, Search } from "lucide-react";
import Input from "@/app/components/ui/Input";
import PageHeader from "@/app/components/ui/PageHeader";
import { useUserMetadata } from "@/app/contexts/UserContext";
import { supabase } from "@/app/utils/supabase";
import { BTN_PRIMARY } from "@/app/utils/buttonClasses";
import { HELP_DESK_CATEGORIES } from "@/app/utils/helpDesk";

type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

const FAQS: FaqItem[] = [
  {
    id: "create",
    question: "How do I create or save an application?",
    answer:
      "Open Create Application from the dashboard, fill in the required details, and save. A draft is stored on your project. Saving the PDF moves the application to In Process.",
  },
  {
    id: "signing",
    question: "How do I sign an application?",
    answer:
      "Open the application details page and use the signing flow. Owners sign first. The appointed consultant then signs. Install DSC Signer from your profile menu if the desktop signer is not set up yet.",
  },
  {
    id: "dsc",
    question: "What is DSC Signer?",
    answer:
      "DSC Signer is the desktop helper used for digital signatures. Use Install DSC Signer in the user menu to download the extension and native host for your system.",
  },
  {
    id: "notifications",
    question: "What is the difference between email and the bell?",
    answer:
      "Application status updates always appear in the header bell. Profile → Notifications only controls whether those same updates are also emailed to you.",
  },
  {
    id: "prefs",
    question: "How do I change my email notification preferences?",
    answer:
      "Open Profile from the user menu, go to the Notifications tab, and toggle the events you want in your inbox. Turning a toggle off does not hide the same event in the bell.",
  },
  {
    id: "consultants",
    question: "How are consultants added to a project?",
    answer:
      "The project owner adds consultants on the applicant roster. The matching consultant for a permission type receives application updates and may need to sign after the owner.",
  },
];

function formatUserName(userMetadata: Record<string, unknown> | null): string {
  if (!userMetadata) return "";
  const parts = [
    String(userMetadata.first_name || "").trim(),
    String(userMetadata.middle_name || "").trim(),
    String(userMetadata.last_name || "").trim(),
  ].filter(Boolean);
  return parts.join(" ");
}

export default function HelpDeskPage() {
  const { userMetadata } = useUserMetadata();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(FAQS[0]?.id ?? null);
  const [category, setCategory] = useState<(typeof HELP_DESK_CATEGORIES)[number]>("Applications");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [accountEmail, setAccountEmail] = useState("");

  const displayName = formatUserName(userMetadata) || "User";
  const email = String(userMetadata?.email || accountEmail || "").trim();

  useEffect(() => {
    void supabase.auth.getUser().then(({ data: { user } }) => {
      const fromAuth = String(user?.email || "").trim();
      if (fromAuth) setAccountEmail(fromAuth);
    });
  }, []);

  const filteredFaqs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQS;
    return FAQS.filter(
      (item) =>
        item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q)
    );
  }, [query]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    setSubmitting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setFormError("Please sign in again to send a message.");
        return;
      }

      const response = await fetch("/api/help-desk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ category, subject: subject.trim(), message: message.trim() }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setFormError(payload.error || "Could not send your message.");
        return;
      }
      setFormSuccess("Message sent. We will reply to your account email.");
      setSubject("");
      setMessage("");
    } catch {
      setFormError("Could not send your message. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Help Desk"
        description="Find answers or send us a message."
      />

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-brand-blue">
            <CircleHelp className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-brand-navy">Frequently asked questions</h2>
            <p className="mt-0.5 text-sm text-gray-500">Search or expand a topic below.</p>
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help articles"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
          />
        </div>

        {filteredFaqs.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">No matching articles.</p>
        ) : (
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            {filteredFaqs.map((item) => {
              const open = openId === item.id;
              return (
                <div key={item.id}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : item.id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-gray-900 hover:bg-gray-50"
                  >
                    {item.question}
                    <ChevronDown
                      className={[
                        "h-4 w-4 shrink-0 text-gray-400 transition-transform",
                        open ? "rotate-180" : "",
                      ].join(" ")}
                    />
                  </button>
                  {open ? (
                    <p className="px-4 pb-3 text-sm leading-relaxed text-gray-600">{item.answer}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-brand-blue">
            <LifeBuoy className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-brand-navy">Contact us</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Send a message and we will reply to your account email.
            </p>
          </div>
        </div>

        <form className="grid gap-4" onSubmit={(e) => void submit(e)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Name" value={displayName} readOnly />
            <Input label="Email" value={email || "—"} readOnly />
          </div>

          <div>
            <label htmlFor="help-category" className="mb-1.5 block text-sm font-medium text-gray-700">
              Category
            </label>
            <select
              id="help-category"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as (typeof HELP_DESK_CATEGORIES)[number])
              }
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
            >
              {HELP_DESK_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Subject"
            value={subject}
            maxLength={200}
            required
            onChange={(e) => setSubject(e.target.value)}
          />

          <div>
            <label htmlFor="help-message" className="mb-1.5 block text-sm font-medium text-gray-700">
              Message
            </label>
            <textarea
              id="help-message"
              required
              maxLength={4000}
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
            />
          </div>

          {formError ? <p className="text-sm text-status-danger">{formError}</p> : null}
          {formSuccess ? <p className="text-sm text-emerald-700">{formSuccess}</p> : null}

          <div>
            <button
              type="submit"
              disabled={submitting}
              className={`${BTN_PRIMARY} rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50`}
            >
              {submitting ? "Sending…" : "Send message"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
