"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "./lib/supabase";

// 사이드바를 표시할 경로
const SIDEBAR_PATHS = ["/explore", "/dashboard"];

type Conversation = {
  id: string;
  character_id: string;
  created_at: string;
};

type CharName = {
  id: string;
  name: string;
};

export function ConversationSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [charNames, setCharNames] = useState<CharName[]>([]);
  const [lastMessages, setLastMessages] = useState<Record<string, string>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const show = SIDEBAR_PATHS.includes(pathname);

  const characterNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of charNames) map[c.id] = c.name;
    return map;
  }, [charNames]);

  // 사이드바가 보이는 페이지에서만 데이터 로드
  useEffect(() => {
    if (!show) return;
    const supabase = createSupabaseBrowserClient();
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: convos }, { data: chars }] = await Promise.all([
        supabase
          .from("conversations")
          .select("id, character_id, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.from("characters").select("id, name").eq("user_id", user.id),
      ]);
      setConversations(convos ?? []);
      setCharNames(chars ?? []);
    }
    void load();
  }, [show]);

  // 마지막 메시지 로드
  useEffect(() => {
    if (conversations.length === 0) return;
    const supabase = createSupabaseBrowserClient();
    async function loadLast() {
      const updates: Record<string, string> = {};
      for (const convo of conversations) {
        const { data } = await supabase
          .from("messages")
          .select("content")
          .eq("conversation_id", convo.id)
          .order("created_at", { ascending: false })
          .limit(1);
        if (data?.[0]) updates[convo.id] = data[0].content ?? "";
      }
      setLastMessages(updates);
    }
    void loadLast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations.length]);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    if (!openMenuId) return;
    function handle() { setOpenMenuId(null); }
    document.addEventListener("click", handle);
    return () => document.removeEventListener("click", handle);
  }, [openMenuId]);

  async function handleDelete(convo: Conversation) {
    const ok = window.confirm("이 대화방을 삭제하시겠습니까? 모든 메시지가 함께 삭제됩니다.");
    if (!ok) return;
    setActionId(convo.id);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.from("messages").delete().eq("conversation_id", convo.id);
      const { error } = await supabase.from("conversations").delete().eq("id", convo.id);
      if (error) throw error;
      setConversations((prev) => prev.filter((c) => c.id !== convo.id));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "삭제 중 오류가 발생했습니다.");
    } finally {
      setActionId(null);
    }
  }

  async function handleCopy(convo: Conversation) {
    setActionId(convo.id);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("로그인이 필요합니다.");
      const newId = crypto.randomUUID();
      const { error } = await supabase.from("conversations").insert({
        id: newId,
        user_id: user.id,
        character_id: convo.character_id,
      });
      if (error) throw error;
      router.push(`/chat/${newId}`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "복사 중 오류가 발생했습니다.");
      setActionId(null);
    }
  }

  if (!show) return null;

  return (
    <aside className="fixed bottom-12 left-0 top-12 z-30 hidden w-56 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 md:flex">
      {/* 헤더 */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <span className="text-sm font-semibold">채팅방</span>
        {conversations.length > 0 && (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {conversations.length}
          </span>
        )}
      </div>

      {/* 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto py-1">
        {conversations.length === 0 ? (
          <p className="px-4 py-4 text-xs text-zinc-500 dark:text-zinc-400">
            아직 대화가 없습니다.
          </p>
        ) : (
          conversations.map((convo) => {
            const preview = (lastMessages[convo.id] ?? "").slice(0, 36).replace(/\s+/g, " ");
            return (
              <div key={convo.id} className="group relative flex items-center">
                <button
                  type="button"
                  onClick={() => router.push(`/chat/${convo.id}`)}
                  className="min-w-0 flex-1 px-3 py-2 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <p className="truncate text-xs font-medium">
                    {characterNameById[convo.character_id] ?? "알 수 없는 캐릭터"}
                  </p>
                  {preview ? (
                    <p className="mt-0.5 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                      {preview}
                    </p>
                  ) : null}
                </button>

                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === convo.id ? null : convo.id);
                    }}
                    disabled={actionId === convo.id}
                    className="mr-1 rounded p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-100 group-hover:opacity-100 disabled:opacity-30 dark:hover:bg-zinc-800"
                  >
                    ⋮
                  </button>
                  {openMenuId === convo.id ? (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-full z-50 w-24 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-md dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <button
                        type="button"
                        onClick={() => { setOpenMenuId(null); void handleCopy(convo); }}
                        className="flex w-full items-center px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        복사
                      </button>
                      <button
                        type="button"
                        onClick={() => { setOpenMenuId(null); void handleDelete(convo); }}
                        className="flex w-full items-center px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                      >
                        삭제
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
