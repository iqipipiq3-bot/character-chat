"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "./lib/supabase";

const SIDEBAR_PATHS = ["/explore", "/dashboard"];

type Folder = {
  id: string;
  name: string;
  created_at: string;
};

type Conversation = {
  id: string;
  character_id: string;
  created_at: string;
  title: string | null;
  folder_id: string | null;
};

type CharName = {
  id: string;
  name: string;
};

// ── 아이콘 ────────────────────────────────────────────────────────────────────
function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg className={`h-2.5 w-2.5 shrink-0 text-zinc-400 transition-transform ${collapsed ? "-rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// ── 인라인 편집 input + ✓✗ ───────────────────────────────────────────────────
function InlineInput({
  value, onChange, onSave, onCancel, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  placeholder?: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <input
        autoFocus
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
        className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800"
      />
      <button type="button" onClick={onSave} className="shrink-0 rounded p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30">
        <CheckIcon />
      </button>
      <button type="button" onClick={onCancel} className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
        <XIcon />
      </button>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export function ConversationSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [charNames, setCharNames] = useState<CharName[]>([]);
  const [lastMessages, setLastMessages] = useState<Record<string, string>>({});
  const [folders, setFolders] = useState<Folder[]>([]);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  // 채팅방 메뉴
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [movingConvoId, setMovingConvoId] = useState<string | null>(null);

  // 폴더 상태
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");

  // 선택 모드
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedConvoIds, setSelectedConvoIds] = useState<Set<string>>(new Set());

  // 드래그앤드롭
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dragOverUnfoldered, setDragOverUnfoldered] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);

  const show = SIDEBAR_PATHS.includes(pathname);

  // 접힌 폴더 localStorage 복원
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar_collapsed_folders");
      if (saved) setCollapsedFolders(new Set(JSON.parse(saved) as string[]));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  const characterNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of charNames) map[c.id] = c.name;
    return map;
  }, [charNames]);

  // 데이터 로드
  useEffect(() => {
    if (!show) return;
    const supabase = createSupabaseBrowserClient();
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: convos, error: convosErr }, { data: folderData }] = await Promise.all([
        supabase
          .from("conversations")
          .select("id, character_id, created_at, title, folder_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("conversation_folders")
          .select("id, name, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
      ]);

      let finalConvos = convos;
      if (convosErr) {
        // title/folder_id 컬럼 없을 경우 폴백
        const { data: fallback } = await supabase
          .from("conversations")
          .select("id, character_id, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        finalConvos = (fallback ?? []).map((c: Record<string, unknown>) => ({ ...c, title: null, folder_id: null })) as typeof finalConvos;
      }

      setConversations((finalConvos ?? []) as Conversation[]);
      setFolders((folderData ?? []) as Folder[]);

      const charIds = [...new Set((finalConvos ?? []).map((c: Record<string, unknown>) => c.character_id as string))];
      if (charIds.length > 0) {
        const { data: chars } = await supabase.from("characters").select("id, name").in("id", charIds);
        setCharNames(chars ?? []);
      }
    }
    void load();
  }, [show]);

  // 마지막 메시지 로드 (병렬)
  useEffect(() => {
    if (conversations.length === 0) return;
    const supabase = createSupabaseBrowserClient();
    async function loadLast() {
      const entries = await Promise.all(
        conversations.map(async (convo) => {
          const { data } = await supabase
            .from("messages").select("content").eq("conversation_id", convo.id)
            .order("created_at", { ascending: false }).limit(1);
          return [convo.id, data?.[0]?.content ?? ""] as const;
        })
      );
      const updates: Record<string, string> = {};
      for (const [id, content] of entries) {
        if (content) updates[id] = content;
      }
      setLastMessages(updates);
    }
    void loadLast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations.length]);

  // 드롭다운 닫기 함수
  function closeMenus() {
    setOpenMenuId(null);
    setMovingConvoId(null);
    setFolderMenuId(null);
  }

  // ── 선택 모드 ──
  function toggleSelectionMode() {
    setSelectionMode((v) => !v);
    setSelectedConvoIds(new Set());
  }

  function toggleSelectConvo(id: string) {
    setSelectedConvoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedConvoIds(new Set(conversations.map((c) => c.id)));
  }

  // ── 폴더 토글 ──
  function toggleFolderCollapse(folderId: string) {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId); else next.add(folderId);
      try { localStorage.setItem("sidebar_collapsed_folders", JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  // ── 폴더 CRUD ──
  async function handleCreateFolder(name: string) {
    const trimmed = name.trim();
    setCreatingFolder(false);
    setNewFolderName("");
    if (!trimmed) return;
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("conversation_folders")
        .insert({ user_id: user.id, name: trimmed })
        .select("id, name, created_at")
        .single();
      if (error) throw error;
      setFolders((prev) => [...prev, data as Folder]);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "폴더 생성 중 오류가 발생했습니다.");
    }
  }

  async function handleRenameFolder(folderId: string, name: string) {
    const trimmed = name.trim();
    setEditingFolderId(null);
    if (!trimmed) return;
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("conversation_folders").update({ name: trimmed }).eq("id", folderId);
      if (error) throw error;
      setFolders((prev) => prev.map((f) => f.id === folderId ? { ...f, name: trimmed } : f));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "수정 중 오류가 발생했습니다.");
    }
  }

  async function handleDeleteFolder(folderId: string) {
    const ok = window.confirm("폴더를 삭제하시겠습니까? 폴더 안 채팅방은 미지정으로 이동됩니다.");
    if (!ok) return;
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.from("conversations").update({ folder_id: null }).eq("folder_id", folderId);
      const { error } = await supabase.from("conversation_folders").delete().eq("id", folderId);
      if (error) throw error;
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      setConversations((prev) => prev.map((c) => c.folder_id === folderId ? { ...c, folder_id: null } : c));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "삭제 중 오류가 발생했습니다.");
    }
  }

  // ── 채팅방 폴더 이동 ──
  async function handleMoveToFolder(convoIds: string[], folderId: string | null) {
    setMovingConvoId(null);
    setOpenMenuId(null);
    if (convoIds.length === 0) return;
    try {
      const supabase = createSupabaseBrowserClient();
      for (const id of convoIds) {
        const { error } = await supabase.from("conversations").update({ folder_id: folderId }).eq("id", id);
        if (error) {
          throw error;
        }
      }
      setConversations((prev) =>
        prev.map((c) => convoIds.includes(c.id) ? { ...c, folder_id: folderId } : c)
      );
      if (selectionMode) setSelectedConvoIds(new Set());
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "이동 중 오류가 발생했습니다.");
    }
  }

  // ── 드래그앤드롭 ──
  function handleDragStart(e: React.DragEvent, convoId: string) {
    // 선택 모드에서 해당 아이템이 선택됨 → 선택된 전체 이동
    const ids = selectionMode && selectedConvoIds.has(convoId)
      ? [...selectedConvoIds]
      : [convoId];
    e.dataTransfer.setData("convoIds", JSON.stringify(ids));
    e.dataTransfer.effectAllowed = "move";
  }

  async function handleDropOnFolder(e: React.DragEvent, folderId: string | null) {
    e.preventDefault();
    setDragOverFolderId(null);
    setDragOverUnfoldered(false);
    const raw = e.dataTransfer.getData("convoIds");
    if (!raw) return;
    const ids: string[] = JSON.parse(raw);
    await handleMoveToFolder(ids, folderId);
  }

  // ── 채팅방 CRUD ──
  async function handleRename(convoId: string, newTitle: string) {
    const trimmed = newTitle.trim();
    setEditingId(null);
    if (!trimmed) return;
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("conversations").update({ title: trimmed }).eq("id", convoId);
      if (error) throw error;
      setConversations((prev) => prev.map((c) => c.id === convoId ? { ...c, title: trimmed } : c));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "수정 중 오류가 발생했습니다.");
    }
  }

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
      setSelectedConvoIds((prev) => { const next = new Set(prev); next.delete(convo.id); return next; });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "삭제 중 오류가 발생했습니다.");
    } finally {
      setActionId(null);
    }
  }

  async function handleBulkDelete() {
    const ids = [...selectedConvoIds];
    if (ids.length === 0) return;
    const ok = window.confirm(`선택한 ${ids.length}개의 채팅방을 삭제할까요? 모든 메시지가 함께 삭제됩니다.`);
    if (!ok) return;
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.from("messages").delete().in("conversation_id", ids);
      const { error } = await supabase.from("conversations").delete().in("id", ids);
      if (error) throw error;
      setConversations((prev) => prev.filter((c) => !ids.includes(c.id)));
      setSelectedConvoIds(new Set());
      setSelectionMode(false);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "삭제 중 오류가 발생했습니다.");
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
        id: newId, user_id: user.id, character_id: convo.character_id,
      });
      if (error) throw error;
      router.push(`/chat/${newId}`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "복사 중 오류가 발생했습니다.");
      setActionId(null);
    }
  }

  if (!show) return null;

  const folderedConvos = (folderId: string) => conversations.filter((c) => c.folder_id === folderId);
  const unfolderedConvos = conversations.filter((c) => !c.folder_id);

  // ── 채팅방 카드 렌더 ──
  function renderConvo(convo: Conversation) {
    const displayName = convo.title || characterNameById[convo.character_id] || "알 수 없는 캐릭터";
    const preview = (lastMessages[convo.id] ?? "").slice(0, 36).replace(/\s+/g, " ");
    const isEditing = editingId === convo.id;
    const isSelected = selectedConvoIds.has(convo.id);

    return (
      <div
        key={convo.id}
        className={`group relative flex items-center ${isSelected ? "bg-blue-50 dark:bg-blue-950/20" : ""}`}
        draggable={!isEditing && !selectionMode}
        onDragStart={(e) => handleDragStart(e, convo.id)}
      >
        {/* 선택 모드 체크박스 */}
        {selectionMode && (
          <button
            type="button"
            onClick={() => toggleSelectConvo(convo.id)}
            className="ml-2 shrink-0"
          >
            <div className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? "border-blue-500 bg-blue-500" : "border-zinc-300 dark:border-zinc-600"}`}>
              {isSelected && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          </button>
        )}

        {isEditing ? (
          <div className="flex min-w-0 flex-1 items-center gap-1 px-2 py-2">
            <InlineInput
              value={editTitle}
              onChange={setEditTitle}
              onSave={() => void handleRename(convo.id, editTitle)}
              onCancel={() => setEditingId(null)}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (selectionMode) { toggleSelectConvo(convo.id); return; }
              router.push(`/chat/${convo.id}`);
            }}
            className="min-w-0 flex-1 px-3 py-2 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            <p className="truncate text-xs font-medium">{displayName}</p>
            {preview ? <p className="mt-0.5 truncate text-[11px] text-zinc-500 dark:text-zinc-400">{preview}</p> : null}
          </button>
        )}

        {!isEditing && !selectionMode && (
          <div className="relative z-20 shrink-0">
            <button
              type="button"
              onClick={() => { setFolderMenuId(null); setMovingConvoId(null); setOpenMenuId(openMenuId === convo.id ? null : convo.id); }}
              disabled={actionId === convo.id}
              className="mr-1 rounded p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-100 group-hover:opacity-100 disabled:opacity-30 dark:hover:bg-zinc-800"
            >
              ⋮
            </button>

            {openMenuId === convo.id && (
              <div
                className="absolute right-0 top-full z-30 w-32 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-md dark:border-zinc-700 dark:bg-zinc-900"
              >
                {movingConvoId === convo.id ? (
                  // 폴더 이동 서브메뉴
                  <>
                    <button
                      type="button"
                      onClick={() => setMovingConvoId(null)}
                      className="flex w-full items-center gap-1.5 border-b border-zinc-100 px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
                    >
                      ← 뒤로
                    </button>
                    {convo.folder_id && (
                      <button
                        type="button"
                        onClick={() => void handleMoveToFolder([convo.id], null)}
                        className="flex w-full items-center px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        폴더 없음
                      </button>
                    )}
                    {folders.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => void handleMoveToFolder([convo.id], f.id)}
                        className={`flex w-full items-center gap-1.5 px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 ${convo.folder_id === f.id ? "font-semibold text-zinc-900 dark:text-zinc-100" : ""}`}
                      >
                        <span>📁</span>
                        <span className="min-w-0 flex-1 truncate">{f.name}</span>
                        {convo.folder_id === f.id && <span className="text-[10px] text-zinc-400">✓</span>}
                      </button>
                    ))}
                    {folders.length === 0 && (
                      <p className="px-3 py-2 text-[11px] text-zinc-400">폴더가 없습니다</p>
                    )}
                  </>
                ) : (
                  // 기본 메뉴
                  <>
                    <button
                      type="button"
                      onClick={() => { setEditTitle(convo.title || characterNameById[convo.character_id] || ""); setEditingId(convo.id); setOpenMenuId(null); }}
                      className="flex w-full items-center px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      제목 수정
                    </button>
                    <button
                      type="button"
                      onClick={() => setMovingConvoId(convo.id)}
                      className="flex w-full items-center justify-between px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <span>폴더로 이동</span><span className="text-zinc-400">›</span>
                    </button>
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
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* 모바일 backdrop */}
      {drawerOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setDrawerOpen(false)} />
      )}

      <aside className={`fixed bottom-0 left-0 top-14 z-40 flex w-64 flex-col border-r border-zinc-200 bg-white transition-transform duration-200 dark:border-zinc-800 dark:bg-zinc-950 md:top-12 md:w-56 md:translate-x-0 md:z-30 ${drawerOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* 드롭다운 외부 클릭 감지 backdrop */}
        {(!!openMenuId || !!folderMenuId) && (
          <div className="absolute inset-0 z-10" onClick={closeMenus} />
        )}

        {/* 헤더 — 편집 모드 시 액션 바로 대체 */}
        {selectionMode ? (
          <div className="shrink-0 border-b border-zinc-200 bg-blue-50 dark:border-zinc-800 dark:bg-blue-950/20">
            {/* 1행: 전체 선택 체크박스 + 선택 개수 */}
            <div className="flex items-center gap-2.5 px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  if (selectedConvoIds.size === conversations.length) {
                    setSelectedConvoIds(new Set());
                  } else {
                    selectAll();
                  }
                }}
                className="flex items-center gap-2"
              >
                <div className={`h-4 w-4 rounded border-2 flex shrink-0 items-center justify-center transition-colors ${selectedConvoIds.size === conversations.length && conversations.length > 0 ? "border-blue-500 bg-blue-500" : selectedConvoIds.size > 0 ? "border-blue-400 bg-blue-100 dark:bg-blue-900/40" : "border-zinc-300 dark:border-zinc-600"}`}>
                  {selectedConvoIds.size === conversations.length && conversations.length > 0 ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : selectedConvoIds.size > 0 ? (
                    <div className="h-1.5 w-1.5 rounded-sm bg-blue-500" />
                  ) : null}
                </div>
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">전체 선택</span>
              </button>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {selectedConvoIds.size > 0 ? `${selectedConvoIds.size}개 선택됨` : ""}
              </span>
            </div>

            {/* 2행: 폴더 이동 + 삭제 + 취소 */}
            <div className="flex items-center gap-2 px-4 pb-3">
              {folders.length > 0 && (
                <select
                  disabled={selectedConvoIds.size === 0}
                  className="min-w-0 flex-1 cursor-pointer rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                  defaultValue=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    e.target.value = "";
                    void handleMoveToFolder([...selectedConvoIds], val === "none" ? null : val);
                  }}
                >
                  <option value="" disabled>폴더로 이동</option>
                  <option value="none">미지정</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              )}
              <button
                type="button"
                disabled={selectedConvoIds.size === 0}
                onClick={() => void handleBulkDelete()}
                className="shrink-0 rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                삭제
              </button>
              <button
                type="button"
                onClick={toggleSelectionMode}
                className="shrink-0 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">채팅방</span>
              {conversations.length > 0 && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {conversations.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => { setCreatingFolder(true); setNewFolderName(""); }}
                className="rounded px-2 py-1 text-[11px] text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                + 폴더
              </button>
              <button
                type="button"
                onClick={toggleSelectionMode}
                className="rounded px-2 py-1 text-[11px] text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                편집
              </button>
            </div>
          </div>
        )}

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto py-1">

          {/* 새 폴더 입력 */}
          {creatingFolder && (
            <div className="flex items-center gap-1 border-b border-zinc-100 px-2 py-2 dark:border-zinc-800">
              <InlineInput
                value={newFolderName}
                onChange={setNewFolderName}
                onSave={() => void handleCreateFolder(newFolderName)}
                onCancel={() => { setCreatingFolder(false); setNewFolderName(""); }}
                placeholder="폴더 이름"
              />
            </div>
          )}

          {conversations.length === 0 && folders.length === 0 ? (
            <p className="px-4 py-4 text-xs text-zinc-500 dark:text-zinc-400">아직 대화가 없습니다.</p>
          ) : (
            <>
              {/* 폴더 목록 */}
              {folders.map((folder) => {
                const folderConvos = folderedConvos(folder.id);
                const isCollapsed = collapsedFolders.has(folder.id);
                const isEditingFolder = editingFolderId === folder.id;
                const isDragOver = dragOverFolderId === folder.id;

                return (
                  <div
                    key={folder.id}
                    onDragOver={(e) => { e.preventDefault(); setDragOverFolderId(folder.id); setDragOverUnfoldered(false); }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverFolderId(null); }}
                    onDrop={(e) => void handleDropOnFolder(e, folder.id)}
                    className={isDragOver ? "rounded bg-blue-50 ring-1 ring-blue-300 dark:bg-blue-950/20 dark:ring-blue-700" : ""}
                  >
                    {/* 폴더 행 */}
                    <div className="group flex items-center">
                      {isEditingFolder ? (
                        <div className="flex min-w-0 flex-1 items-center gap-1 px-2 py-1.5">
                          <InlineInput
                            value={editFolderName}
                            onChange={setEditFolderName}
                            onSave={() => void handleRenameFolder(folder.id, editFolderName)}
                            onCancel={() => setEditingFolderId(null)}
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleFolderCollapse(folder.id)}
                          className="flex min-w-0 flex-1 items-center gap-1.5 px-3 py-1.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
                        >
                          <span className="text-xs">📁</span>
                          <span className="min-w-0 flex-1 truncate text-xs font-medium">{folder.name}</span>
                          {folderConvos.length > 0 && (
                            <span className="text-[10px] text-zinc-400">{folderConvos.length}</span>
                          )}
                          <ChevronIcon collapsed={isCollapsed} />
                        </button>
                      )}

                      {!isEditingFolder && !selectionMode && (
                        <div className="relative z-20 shrink-0">
                          <button
                            type="button"
                            onClick={() => { setOpenMenuId(null); setFolderMenuId(folderMenuId === folder.id ? null : folder.id); }}
                            className="mr-1 rounded p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-100 group-hover:opacity-100 dark:hover:bg-zinc-800"
                          >
                            ⋮
                          </button>
                          {folderMenuId === folder.id && (
                            <div
                              className="absolute right-0 top-full z-30 w-24 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-md dark:border-zinc-700 dark:bg-zinc-900"
                            >
                              <button
                                type="button"
                                onClick={() => { setFolderMenuId(null); setEditFolderName(folder.name); setEditingFolderId(folder.id); }}
                                className="flex w-full items-center px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
                              >
                                이름 수정
                              </button>
                              <button
                                type="button"
                                onClick={() => { setFolderMenuId(null); void handleDeleteFolder(folder.id); }}
                                className="flex w-full items-center px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                              >
                                삭제
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 폴더 내 채팅방 */}
                    {!isCollapsed && (
                      <div className="ml-3 border-l-2 border-zinc-100 dark:border-zinc-800">
                        {folderConvos.length === 0 ? (
                          <p className="py-1.5 pl-3 text-[11px] text-zinc-400">비어 있음</p>
                        ) : (
                          folderConvos.map((convo) => renderConvo(convo))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 구분선 + 미지정 레이블 (드롭존) */}
              {folders.length > 0 && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOverUnfoldered(true); setDragOverFolderId(null); }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverUnfoldered(false); }}
                  onDrop={(e) => void handleDropOnFolder(e, null)}
                  className={`mt-1 border-t border-zinc-100 px-3 pt-2 dark:border-zinc-800 ${dragOverUnfoldered ? "rounded bg-zinc-100 dark:bg-zinc-800" : ""}`}
                >
                  <p className="pb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">미지정</p>
                </div>
              )}

              {/* 미지정 채팅방 */}
              {unfolderedConvos.map((convo) => renderConvo(convo))}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
