"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CharacterCardsClient } from "./CharacterCardsClient";
import { createSupabaseBrowserClient } from "../lib/supabase";
import { showToast } from "../components/Toast";

type Character = {
  id: string;
  name: string;
  model: string | null;
  created_at: string;
  is_public: boolean | null;
  visibility: string | null;
  thumbnail_url: string | null;
  description: string | null;
};

type PromptTemplate = {
  id: string;
  title: string;
  content: string;
};

type LoreTemplate = {
  id: string;
  title: string;
  keywords: string[];
  content: string;
};

type DashboardTabsClientProps = {
  characters: Character[];
};

const MAX_TEMPLATE_LENGTH = 7000;
const MAX_LORE_CONTENT_LENGTH = 400;

function charCountColor(len: number, max: number) {
  if (len >= max) return "text-red-500";
  if (len >= max * (6500 / 7000)) return "text-orange-400";
  return "text-zinc-400 dark:text-zinc-500";
}

// ── 섹션 헤더 ──────────────────────────────────────────────────────────────────
function SectionHeader({
  title,
  count,
  max,
  open,
  onToggle,
  action,
}: {
  title: string;
  count: number;
  max: number;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 text-left"
      >
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">{count}/{max}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 12 12"
          fill="none"
          className={`shrink-0 text-zinc-400 transition-transform ${open ? "" : "-rotate-90"}`}
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {action}
    </div>
  );
}

export function DashboardTabsClient({ characters }: DashboardTabsClientProps) {
  // ── 프롬프트 템플릿 ──
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [promptLoading, setPromptLoading] = useState(true);
  const [promptOpen, setPromptOpen] = useState(true);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addContent, setAddContent] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // ── 로어북 템플릿 ──
  const [loreTemplates, setLoreTemplates] = useState<LoreTemplate[]>([]);
  const [loreLoading, setLoreLoading] = useState(true);
  const [loreOpen, setLoreOpen] = useState(true);

  const [showLoreAddForm, setShowLoreAddForm] = useState(false);
  const [loreAddTitle, setLoreAddTitle] = useState("");
  const [loreAddKeywordInput, setLoreAddKeywordInput] = useState("");
  const [loreAddKeywords, setLoreAddKeywords] = useState<string[]>([]);
  const [loreAddContent, setLoreAddContent] = useState("");
  const [loreAddSaving, setLoreAddSaving] = useState(false);

  const [loreEditingId, setLoreEditingId] = useState<string | null>(null);
  const [loreEditTitle, setLoreEditTitle] = useState("");
  const [loreEditKeywordInput, setLoreEditKeywordInput] = useState("");
  const [loreEditKeywords, setLoreEditKeywords] = useState<string[]>([]);
  const [loreEditContent, setLoreEditContent] = useState("");
  const [loreEditSaving, setLoreEditSaving] = useState(false);

  // ── 프롬프트 템플릿 handlers ──

  async function loadTemplates() {
    setPromptLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("prompt_templates")
      .select("id, title, content")
      .order("created_at", { ascending: false });
    setTemplates(data ?? []);
    setPromptLoading(false);
  }

  async function handleAdd() {
    if (!addTitle.trim() || !addContent.trim()) return;
    setAddSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setAddSaving(false);
      showToast("로그인이 필요합니다.", "error");
      return;
    }
    const { error } = await supabase
      .from("prompt_templates")
      .insert({
        user_id: user.id,
        title: addTitle.trim(),
        content: addContent.trim(),
      })
      .select("id")
      .single();
    setAddSaving(false);
    if (error) {
      showToast(`저장 실패: ${error.message}`, "error");
      return;
    }
    setAddTitle("");
    setAddContent("");
    setShowAddForm(false);
    showToast("템플릿을 추가했습니다.");
    await loadTemplates();
  }

  async function handleEditSave() {
    if (!editingId || !editTitle.trim() || !editContent.trim()) return;
    setEditSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setEditSaving(false);
      showToast("로그인이 필요합니다.", "error");
      return;
    }
    const { data, error } = await supabase
      .from("prompt_templates")
      .update({ title: editTitle.trim(), content: editContent.trim() })
      .eq("id", editingId)
      .eq("user_id", user.id)
      .select("id, title, content");
    setEditSaving(false);
    if (error) {
      showToast(`저장 실패: ${error.message}`, "error");
      return;
    }
    if (!data || data.length === 0) {
      showToast("저장 실패: 권한이 없거나 템플릿을 찾을 수 없습니다.", "error");
      return;
    }
    setEditingId(null);
    showToast("템플릿을 저장했습니다.");
    await loadTemplates();
  }

  async function handleDelete(id: string) {
    const ok = window.confirm("템플릿을 삭제하시겠습니까?");
    if (!ok) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("prompt_templates").delete().eq("id", id);
    if (error) {
      showToast(`삭제 실패: ${error.message}`, "error");
      return;
    }
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    showToast("템플릿을 삭제했습니다.");
  }

  function startEdit(t: PromptTemplate) {
    setEditingId(t.id);
    setEditTitle(t.title);
    setEditContent(t.content);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle("");
    setEditContent("");
  }

  // ── 로어북 템플릿 handlers ──

  async function loadLoreTemplates() {
    setLoreLoading(true);
    const res = await fetch("/api/lorebook-templates");
    if (res.ok) {
      const data = (await res.json()) as { templates: LoreTemplate[] };
      setLoreTemplates(data.templates);
    }
    setLoreLoading(false);
  }

  useEffect(() => {
    void Promise.all([loadTemplates(), loadLoreTemplates()]);
  }, []);

  async function handleLoreAdd() {
    if (!loreAddTitle.trim() || !loreAddContent.trim()) return;
    setLoreAddSaving(true);
    const res = await fetch("/api/lorebook-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: loreAddTitle, keywords: loreAddKeywords, content: loreAddContent }),
    });
    if (res.ok) {
      setLoreAddTitle("");
      setLoreAddKeywords([]);
      setLoreAddKeywordInput("");
      setLoreAddContent("");
      setShowLoreAddForm(false);
      await loadLoreTemplates();
    }
    setLoreAddSaving(false);
  }

  async function handleLoreEditSave() {
    if (!loreEditingId || !loreEditTitle.trim() || !loreEditContent.trim()) return;
    setLoreEditSaving(true);
    const res = await fetch(`/api/lorebook-templates/${loreEditingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: loreEditTitle, keywords: loreEditKeywords, content: loreEditContent }),
    });
    setLoreEditSaving(false);
    if (res.ok) {
      setLoreEditingId(null);
      showToast("로어북 템플릿을 저장했습니다.");
      await loadLoreTemplates();
    } else {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      showToast(`저장 실패: ${err.error ?? res.statusText}`, "error");
    }
  }

  async function handleLoreDelete(id: string) {
    const ok = window.confirm("템플릿을 삭제하시겠습니까?");
    if (!ok) return;
    await fetch(`/api/lorebook-templates/${id}`, { method: "DELETE" });
    setLoreTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  function startLoreEdit(t: LoreTemplate) {
    setLoreEditingId(t.id);
    setLoreEditTitle(t.title);
    setLoreEditKeywords(t.keywords);
    setLoreEditKeywordInput("");
    setLoreEditContent(t.content);
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] md:min-h-[calc(100vh-3rem)] bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="md:pl-56">
        <div className="flex min-h-[calc(100vh-3.5rem)] md:min-h-[calc(100vh-3rem)] flex-col md:flex-row">

          {/* ── 왼쪽: 내 캐릭터 목록 ── */}
          <div className="w-full border-b border-zinc-200 px-4 py-6 pb-24 md:w-1/2 md:border-b-0 md:border-r md:px-6 md:py-10 md:pb-10 dark:border-zinc-800">
            <header className="mb-8 flex items-center justify-between">
              <h1 className="text-2xl font-semibold tracking-tight">제작 스튜디오</h1>
              <Link
                href="/characters/create"
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                + 새 캐릭터 만들기
              </Link>
            </header>
            <CharacterCardsClient initial={characters} />
          </div>

          {/* ── 오른쪽: 템플릿 패널 ── */}
          <div className="w-full px-6 py-10 md:w-1/2">
            <h2 className="mb-6 text-lg font-semibold tracking-tight">템플릿</h2>

            <div className="space-y-8">

              {/* ══ 프롬프트 템플릿 섹션 ══ */}
              <section>
                <SectionHeader
                  title="프롬프트 템플릿"
                  count={templates.length}
                  max={10}
                  open={promptOpen}
                  onToggle={() => setPromptOpen((v) => !v)}
                  action={
                    !showAddForm && promptOpen ? (
                      templates.length >= 10 ? (
                        <span className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-400 dark:border-zinc-700 dark:text-zinc-600">
                          최대 10개
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowAddForm(true)}
                          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
                        >
                          + 새 템플릿 추가
                        </button>
                      )
                    ) : undefined
                  }
                />

                {promptOpen && (
                  <div className="mt-4 space-y-3">
                    {/* 추가 폼 */}
                    {showAddForm && (
                      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                        <input
                          type="text"
                          value={addTitle}
                          onChange={(e) => setAddTitle(e.target.value)}
                          placeholder="템플릿 이름"
                          maxLength={50}
                          autoFocus
                          className="mb-2 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-500"
                        />
                        <textarea
                          rows={5}
                          value={addContent}
                          onChange={(e) => setAddContent(e.target.value)}
                          placeholder="템플릿 내용을 입력하세요..."
                          maxLength={MAX_TEMPLATE_LENGTH}
                          className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-500"
                        />
                        <p className={`mb-2 text-right text-[10px] ${charCountColor(addContent.length, MAX_TEMPLATE_LENGTH)}`}>
                          {addContent.length.toLocaleString()} / 7,000
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => { setShowAddForm(false); setAddTitle(""); setAddContent(""); }}
                            className="flex-1 rounded-lg border border-zinc-200 py-2 text-xs text-zinc-500 hover:border-zinc-400 dark:border-zinc-700"
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            disabled={!addTitle.trim() || !addContent.trim() || addSaving}
                            onClick={() => void handleAdd()}
                            className="flex-1 rounded-lg bg-zinc-900 py-2 text-xs text-white disabled:opacity-40 hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                          >
                            저장
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 목록 */}
                    {promptLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                        ))}
                      </div>
                    ) : templates.length === 0 ? (
                      <p className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-600">
                        아직 저장된 템플릿이 없습니다
                      </p>
                    ) : (
                      templates.map((t) =>
                        editingId === t.id ? (
                          <div key={t.id} className="rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              maxLength={50}
                              autoFocus
                              className="mb-2 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-500"
                            />
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              maxLength={MAX_TEMPLATE_LENGTH}
                              className="w-full min-h-[400px] resize-y overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-500"
                            />
                            <p className={`mb-2 text-right text-[10px] ${charCountColor(editContent.length, MAX_TEMPLATE_LENGTH)}`}>
                              {editContent.length.toLocaleString()} / 7,000
                            </p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="flex-1 rounded-lg border border-zinc-200 py-2 text-xs text-zinc-500 hover:border-zinc-400 dark:border-zinc-700"
                              >
                                취소
                              </button>
                              <button
                                type="button"
                                disabled={!editTitle.trim() || !editContent.trim() || editSaving}
                                onClick={() => void handleEditSave()}
                                className="flex-1 rounded-lg bg-zinc-900 py-2 text-xs text-white disabled:opacity-40 hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                              >
                                저장
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div key={t.id} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                            <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                              {t.title}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                              {t.content.slice(0, 80)}{t.content.length > 80 ? "…" : ""}
                            </p>
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                onClick={() => startEdit(t)}
                                className="flex-1 rounded-md border border-zinc-200 py-1.5 text-xs text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500"
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDelete(t.id)}
                                className="flex-1 rounded-md border border-red-200 py-1.5 text-xs text-red-500 hover:border-red-400 dark:border-red-900 dark:hover:border-red-700"
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                        )
                      )
                    )}
                  </div>
                )}
              </section>

              {/* 구분선 */}
              <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

              {/* ══ 로어북 템플릿 섹션 ══ */}
              <section>
                <SectionHeader
                  title="로어북 템플릿"
                  count={loreTemplates.length}
                  max={10}
                  open={loreOpen}
                  onToggle={() => setLoreOpen((v) => !v)}
                  action={
                    !showLoreAddForm && loreOpen ? (
                      loreTemplates.length >= 10 ? (
                        <span className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-400 dark:border-zinc-700 dark:text-zinc-600">
                          최대 10개
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowLoreAddForm(true)}
                          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
                        >
                          + 새 템플릿 추가
                        </button>
                      )
                    ) : undefined
                  }
                />

                {loreOpen && (
                  <div className="mt-4 space-y-3">
                    {/* 추가 폼 */}
                    {showLoreAddForm && (
                      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                        <input
                          type="text"
                          value={loreAddTitle}
                          onChange={(e) => setLoreAddTitle(e.target.value)}
                          placeholder="템플릿 이름"
                          maxLength={50}
                          autoFocus
                          className="mb-2 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-500"
                        />
                        {/* 키워드 입력 */}
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {loreAddKeywords.map((kw, idx) => (
                            <span key={idx} className="flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                              {kw}
                              <button
                                type="button"
                                onClick={() => setLoreAddKeywords((p) => p.filter((_, i) => i !== idx))}
                                className="text-zinc-400 hover:text-zinc-600"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          {loreAddKeywords.length < 5 && (
                            <input
                              type="text"
                              value={loreAddKeywordInput}
                              onChange={(e) => setLoreAddKeywordInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const kw = loreAddKeywordInput.trim();
                                  if (kw && !loreAddKeywords.includes(kw)) {
                                    setLoreAddKeywords((p) => [...p, kw]);
                                    setLoreAddKeywordInput("");
                                  }
                                }
                              }}
                              placeholder="키워드 입력 후 Enter"
                              className="min-w-[140px] flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-500"
                            />
                          )}
                        </div>
                        <textarea
                          rows={4}
                          value={loreAddContent}
                          onChange={(e) => setLoreAddContent(e.target.value)}
                          placeholder="템플릿 내용을 입력하세요..."
                          maxLength={MAX_LORE_CONTENT_LENGTH}
                          className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-500"
                        />
                        <p className={`mb-2 text-right text-[10px] ${charCountColor(loreAddContent.length, MAX_LORE_CONTENT_LENGTH)}`}>
                          {loreAddContent.length} / {MAX_LORE_CONTENT_LENGTH}
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => { setShowLoreAddForm(false); setLoreAddTitle(""); setLoreAddKeywords([]); setLoreAddKeywordInput(""); setLoreAddContent(""); }}
                            className="flex-1 rounded-lg border border-zinc-200 py-2 text-xs text-zinc-500 hover:border-zinc-400 dark:border-zinc-700"
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            disabled={!loreAddTitle.trim() || !loreAddContent.trim() || loreAddSaving}
                            onClick={() => void handleLoreAdd()}
                            className="flex-1 rounded-lg bg-zinc-900 py-2 text-xs text-white disabled:opacity-40 hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                          >
                            저장
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 목록 */}
                    {loreLoading ? (
                      <div className="space-y-3">
                        {[1, 2].map((i) => (
                          <div key={i} className="h-20 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                        ))}
                      </div>
                    ) : loreTemplates.length === 0 ? (
                      <p className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-600">
                        아직 저장된 템플릿이 없습니다
                      </p>
                    ) : (
                      loreTemplates.map((t) =>
                        loreEditingId === t.id ? (
                          /* 인라인 수정 폼 */
                          <div key={t.id} className="rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
                            <input
                              type="text"
                              value={loreEditTitle}
                              onChange={(e) => setLoreEditTitle(e.target.value)}
                              maxLength={50}
                              autoFocus
                              className="mb-2 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-500"
                            />
                            {/* 키워드 수정 */}
                            <div className="mb-2 flex flex-wrap gap-1.5">
                              {loreEditKeywords.map((kw, idx) => (
                                <span key={idx} className="flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                  {kw}
                                  <button
                                    type="button"
                                    onClick={() => setLoreEditKeywords((p) => p.filter((_, i) => i !== idx))}
                                    className="text-zinc-400 hover:text-zinc-600"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                              {loreEditKeywords.length < 5 && (
                                <input
                                  type="text"
                                  value={loreEditKeywordInput}
                                  onChange={(e) => setLoreEditKeywordInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      const kw = loreEditKeywordInput.trim();
                                      if (kw && !loreEditKeywords.includes(kw)) {
                                        setLoreEditKeywords((p) => [...p, kw]);
                                        setLoreEditKeywordInput("");
                                      }
                                    }
                                  }}
                                  placeholder="키워드 입력 후 Enter"
                                  className="min-w-[140px] flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-500"
                                />
                              )}
                            </div>
                            <textarea
                              value={loreEditContent}
                              onChange={(e) => setLoreEditContent(e.target.value)}
                              maxLength={MAX_LORE_CONTENT_LENGTH}
                              className="w-full min-h-[200px] resize-y rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-500"
                            />
                            <p className={`mb-2 text-right text-[10px] ${charCountColor(loreEditContent.length, MAX_LORE_CONTENT_LENGTH)}`}>
                              {loreEditContent.length} / {MAX_LORE_CONTENT_LENGTH}
                            </p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setLoreEditingId(null)}
                                className="flex-1 rounded-lg border border-zinc-200 py-2 text-xs text-zinc-500 hover:border-zinc-400 dark:border-zinc-700"
                              >
                                취소
                              </button>
                              <button
                                type="button"
                                disabled={!loreEditTitle.trim() || !loreEditContent.trim() || loreEditSaving}
                                onClick={() => void handleLoreEditSave()}
                                className="flex-1 rounded-lg bg-zinc-900 py-2 text-xs text-white disabled:opacity-40 hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                              >
                                저장
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* 카드 */
                          <div key={t.id} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                            <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">{t.title}</p>
                            {t.keywords.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {t.keywords.map((kw, idx) => (
                                  <span key={idx} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                                    {kw}
                                  </span>
                                ))}
                              </div>
                            )}
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                              {t.content.slice(0, 80)}{t.content.length > 80 ? "…" : ""}
                            </p>
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                onClick={() => startLoreEdit(t)}
                                className="flex-1 rounded-md border border-zinc-200 py-1.5 text-xs text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500"
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleLoreDelete(t.id)}
                                className="flex-1 rounded-md border border-red-200 py-1.5 text-xs text-red-500 hover:border-red-400 dark:border-red-900 dark:hover:border-red-700"
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                        )
                      )
                    )}
                  </div>
                )}
              </section>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
