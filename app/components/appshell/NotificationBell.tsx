"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { supabase } from "@/app/utils/supabase";

type InboxNotification = {
  id: string;
  title: string;
  body: string;
  link_url: string;
  read_at: string | null;
  created_at: string;
};

const INBOX_LIMIT = 50;

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const sec = Math.round((Date.now() - then) / 1000);
  if (sec < 45) return "Just now";
  if (sec < 3600) return `${Math.max(1, Math.round(sec / 60))}m ago`;
  if (sec < 86400) return `${Math.max(1, Math.round(sec / 3600))}h ago`;
  if (sec < 604800) return `${Math.max(1, Math.round(sec / 86400))}d ago`;
  return new Date(iso).toLocaleDateString();
}

function toAppPath(linkUrl: string): string {
  const trimmed = linkUrl.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/")) return trimmed;
  try {
    const url = new URL(trimmed);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return trimmed;
  }
}

function mergeNotification(
  list: InboxNotification[],
  incoming: InboxNotification
): InboxNotification[] {
  const without = list.filter((item) => item.id !== incoming.id);
  return [incoming, ...without]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, INBOX_LIMIT);
}

export default function NotificationBell() {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const unreadCount = items.filter((item) => !item.read_at).length;
  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount);

  const loadInbox = useCallback(async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, body, link_url, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(INBOX_LIMIT);

    if (error) {
      console.error("[notifications] Failed to load inbox:", error.message);
      setItems([]);
      setLoading(false);
      return;
    }

    setItems((data as InboxNotification[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const teardown = () => {
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    };

    const attach = async (userId: string) => {
      teardown();
      if (cancelled) return;
      setLoading(true);
      await loadInbox();
      if (cancelled) return;

      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const row = (payload.new ?? payload.old) as InboxNotification | undefined;
            if (!row?.id) return;
            if (payload.eventType === "DELETE") {
              setItems((prev) => prev.filter((item) => item.id !== row.id));
              return;
            }
            const incoming = payload.new as InboxNotification;
            if (!incoming?.id) return;
            setItems((prev) => mergeNotification(prev, incoming));
          }
        )
        .subscribe();
    };

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user?.id) {
        void attach(session.user.id);
      } else {
        setItems([]);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session?.user?.id) {
        void attach(session.user.id);
      } else {
        teardown();
        setItems([]);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      teardown();
    };
  }, [loadInbox]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (panelRef.current && !panelRef.current.contains(target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const cancelClose = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, 160);
  };

  useEffect(() => () => cancelClose(), []);

  const markRead = async (id: string) => {
    const readAt = new Date().toISOString();
    setItems((prev) =>
      prev.map((item) => (item.id === id && !item.read_at ? { ...item, read_at: readAt } : item))
    );
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("id", id)
      .is("read_at", null);
    if (error) {
      console.error("[notifications] Failed to mark read:", error.message);
    }
  };

  const markAllRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    const readAt = new Date().toISOString();
    const unreadIds = items.filter((item) => !item.read_at).map((item) => item.id);
    setItems((prev) => prev.map((item) => (item.read_at ? item : { ...item, read_at: readAt })));
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .in("id", unreadIds)
      .is("read_at", null);
    if (error) {
      console.error("[notifications] Failed to mark all read:", error.message);
      await loadInbox();
    }
    setMarkingAll(false);
  };

  const openNotification = async (item: InboxNotification) => {
    if (!item.read_at) await markRead(item.id);
    setOpen(false);
    const path = toAppPath(item.link_url);
    if (path) router.push(path);
  };

  return (
    <div
      className="relative"
      ref={panelRef}
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-danger px-1 text-[10px] font-semibold leading-none text-white">
            {badgeLabel}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 pt-2">
          <div className="flex w-[min(24rem,calc(100vw-2rem))] max-h-[min(28rem,calc(100dvh-5rem))] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Notifications</h2>
            {unreadCount > 0 ? (
              <button
                type="button"
                disabled={markingAll}
                onClick={() => void markAllRead()}
                className="text-xs font-semibold text-brand-blue hover:text-brand-blue-hover disabled:opacity-50"
              >
                Mark all as read
              </button>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {loading ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500">
                No notifications yet.
              </p>
            ) : (
              <ul>
                {items.map((item) => {
                  const unread = !item.read_at;
                  return (
                    <li key={item.id} className="border-b border-gray-50 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => void openNotification(item)}
                        className={[
                          "flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-gray-50",
                          unread ? "bg-blue-50/60" : "bg-white",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={[
                              "text-sm",
                              unread ? "font-semibold text-gray-900" : "font-medium text-gray-800",
                            ].join(" ")}
                          >
                            {item.title}
                          </span>
                          {unread ? (
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-blue" />
                          ) : null}
                        </div>
                        {item.body ? (
                          <span className="line-clamp-2 text-xs text-gray-600">{item.body}</span>
                        ) : null}
                        <span className="text-[11px] text-gray-400">
                          {formatRelativeTime(item.created_at)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
