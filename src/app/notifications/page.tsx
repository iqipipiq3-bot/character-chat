"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "../lib/supabase";

type Notification = {
  id: string;
  type: string;
  title: string | null;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

type Notice = {
  id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  author_id: string | null;
  created_at: string;
  updated_at: string;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

function typeIcon(type: string) {
  if (type === "follow") return "👤";
  if (type === "comment") return "💬";
  if (type === "reply") return "↩️";
  if (type === "notice") return "📢";
  return "🔔";
}

export default function NotificationsPage() {
  const [tab, setTab] = useState<"notifications" | "notices">("notifications");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showWrite, setShowWrite] = useState(false);
  const [writeTitle, setWriteTitle] = useState("");
  const [writeContent, setWriteContent] = useState("");
  const [writePinned, setWritePinned] = useState(false);
  const [writeSaving, setWriteSaving] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);

  const loadNotifications = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (res.ok) {
      const json = await res.json() as { notifications: Notification[] };
      setNotifications(json.notifications ?? []);
      // 전체 읽음 처리
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    }
  }, []);

  const loadNotices = useCallback(async () => {
    const res = await fetch("/api/notices");
    if (res.ok) {
      const json = await res.json() as { notices: Notice[] };
      setNotices(json.notices ?? []);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("user_id", user.id)
          .maybeSingle();
        setIsAdmin(profile?.is_admin === true);
      }
      await Promise.all([loadNotifications(), loadNotices()]);
      setLoading(false);
    })();
  }, [loadNotifications, loadNotices]);

  async function handleCreateNotice() {
    if (!writeTitle.trim() || !writeContent.trim() || writeSaving) return;
    setWriteSaving(true);
    try {
      const res = await fetch("/api/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: writeTitle, content: writeContent, is_pinned: writePinned }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "작성 실패");
      }
      setShowWrite(false);
      setWriteTitle("");
      setWriteContent("");
      setWritePinned(false);
      await loadNotices();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "작성 중 오류");
    } finally {
      setWriteSaving(false);
    }
  }

  async function handleDeleteNotice(id: string) {
    if (!window.confirm("공지를 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/notices/${id}`, { method: "DELETE" });
    if (res.ok) {
      setNotices((prev) => prev.filter((n) => n.id !== id));
      setSelectedNotice(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 pb-24 md:px-6 md:py-10">
      <h1 className="text-xl font-semibold tracking-tight">알림</h1>

      {/* 탭 */}
      <div className="mt-4 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {[
          { key: "notifications", label: "알림" },
          { key: "notices", label: "공지사항" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key as "notifications" | "notices")}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-8 text-center text-sm text-zinc-400">불러오는 중…</p>
      ) : tab === "notifications" ? (
        <div className="mt-4">
          {notifications.length === 0 ? (
            <p className="mt-12 text-center text-sm text-zinc-400">새로운 알림이 없습니다</p>
          ) : (
            <ul className="space-y-1">
              {notifications.map((n) => {
                const body = (
                  <div
                    className={`flex items-start gap-3 rounded-lg px-3 py-3 ${
                      n.is_read ? "bg-transparent" : "bg-zinc-50 dark:bg-zinc-900"
                    }`}
                  >
                    <span className="text-lg">{typeIcon(n.type)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-900 dark:text-zinc-100">{n.message}</p>
                      <p className="mt-0.5 text-[11px] text-zinc-400">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link href={n.link} className="block hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
                        {body}
                      </Link>
                    ) : body}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="mt-4">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowWrite(true)}
              className="mb-3 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              + 공지 작성
            </button>
          )}
          {notices.length === 0 ? (
            <p className="mt-12 text-center text-sm text-zinc-400">공지사항이 없습니다</p>
          ) : (
            <ul className="space-y-2">
              {notices.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedNotice(n)}
                    className="flex w-full items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-3 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                  >
                    {n.is_pinned && (
                      <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 dark:bg-red-900/40 dark:text-red-300">
                        고정
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{n.title}</p>
                      <p className="mt-0.5 text-[11px] text-zinc-400">
                        {new Date(n.created_at).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 공지 상세 모달 */}
      {selectedNotice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setSelectedNotice(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-5 dark:bg-zinc-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{selectedNotice.title}</h2>
              <button
                type="button"
                onClick={() => setSelectedNotice(null)}
                className="shrink-0 text-zinc-400 hover:text-zinc-600"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 text-[11px] text-zinc-400">
              {new Date(selectedNotice.created_at).toLocaleDateString("ko-KR")}
            </p>
            <div className="mt-3 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
              {selectedNotice.content}
            </div>
            {isAdmin && (
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void handleDeleteNotice(selectedNotice.id)}
                  className="rounded-lg px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  삭제
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 공지 작성 모달 */}
      {showWrite && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowWrite(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-5 dark:bg-zinc-950"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">공지 작성</h2>
            <input
              type="text"
              value={writeTitle}
              onChange={(e) => setWriteTitle(e.target.value)}
              placeholder="제목"
              className="mt-3 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <textarea
              value={writeContent}
              onChange={(e) => setWriteContent(e.target.value)}
              placeholder="내용"
              rows={8}
              className="mt-2 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={writePinned}
                onChange={(e) => setWritePinned(e.target.checked)}
              />
              상단 고정
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowWrite(false)}
                className="rounded-lg px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleCreateNotice()}
                disabled={writeSaving}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {writeSaving ? "저장 중…" : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
