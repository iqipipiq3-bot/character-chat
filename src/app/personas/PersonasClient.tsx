"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabase";

type Persona = {
  id: string;
  name: string;
  description: string;
  content: string;
  is_default: boolean;
  created_at: string;
};

export function PersonasClient({ initial, userId }: { initial: Persona[]; userId: string }) {
  const router = useRouter();
  const [personas, setPersonas] = useState<Persona[]>(initial);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function startAdd() {
    setEditingId("new");
    setEditName("");
    setEditDescription("");
    setEditContent("");
  }

  function startEdit(p: Persona) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditDescription(p.description ?? "");
    setEditContent(p.content);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditDescription("");
    setEditContent("");
  }

  async function handleSave() {
    if (saving) return;
    const name = editName.trim();
    const description = editDescription.trim();
    const content = editContent.trim();
    if (!name || !content) {
      window.alert("이름과 내용을 모두 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      if (editingId === "new") {
        const { data, error } = await supabase
          .from("personas")
          .insert({ user_id: userId, name, description, content, is_default: false })
          .select()
          .single();
        if (error) throw error;
        setPersonas((prev) => [...prev, data as Persona]);
      } else {
        const { error } = await supabase
          .from("personas")
          .update({ name, description, content })
          .eq("id", editingId);
        if (error) throw error;
        setPersonas((prev) =>
          prev.map((p) => (p.id === editingId ? { ...p, name, description, content } : p))
        );
      }
      cancelEdit();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(personaId: string) {
    setBusyId(personaId);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: resetError } = await supabase
        .from("personas")
        .update({ is_default: false })
        .eq("user_id", userId);
      if (resetError) throw resetError;
      const { error } = await supabase
        .from("personas")
        .update({ is_default: true })
        .eq("id", personaId);
      if (error) throw error;
      setPersonas((prev) => prev.map((p) => ({ ...p, is_default: p.id === personaId })));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(personaId: string) {
    const ok = window.confirm("이 페르소나를 삭제하시겠습니까?");
    if (!ok) return;
    setBusyId(personaId);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("personas").delete().eq("id", personaId);
      if (error) throw error;
      setPersonas((prev) => prev.filter((p) => p.id !== personaId));
      if (editingId === personaId) cancelEdit();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "삭제 중 오류가 발생했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  // 폼 버튼 공통 JSX (중첩 컴포넌트로 만들지 않고 인라인으로 렌더링해야 커서가 유지됨)
  const formButtons = (
    <div className="mt-3 flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={cancelEdit}
        className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        취소
      </button>
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {saving ? "저장 중..." : "저장"}
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
        <button
          type="button"
          onClick={() => router.push("/mypage")}
          className="w-fit text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← 마이페이지로
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">페르소나 관리</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              AI 대화에 적용될 내 페르소나를 관리합니다. (최대 10개)
            </p>
          </div>
          <button
            type="button"
            onClick={startAdd}
            disabled={personas.length >= 10 || editingId === "new"}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            + 새 페르소나
          </button>
        </div>

        {/* 새 페르소나 추가 폼 — 인라인 JSX로 렌더링 (중첩 컴포넌트 금지) */}
        {editingId === "new" && (
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="mb-3 text-sm font-semibold">새 페르소나 추가</p>
            <div className="relative mb-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={20}
                placeholder="페르소나 이름 (예: 학생, 직장인)"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
              />
              <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-zinc-400">
                {editName.length}/20
              </span>
            </div>
            <div className="relative mb-2">
              <input
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                maxLength={50}
                placeholder="이 페르소나를 한 줄로 설명해주세요"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
              />
              <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-zinc-400">
                {editDescription.length}/50
              </span>
            </div>
            <div className="relative">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                maxLength={1000}
                placeholder="페르소나 내용 (예: 나는 20대 대학생이며...)"
                rows={4}
                className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 pb-6 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
              />
              <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-zinc-400">
                {editContent.length}/1000
              </span>
            </div>
            {formButtons}
          </div>
        )}

        {personas.length === 0 && editingId !== "new" ? (
          <div className="rounded-lg border border-zinc-200 bg-white px-6 py-10 text-center dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              아직 페르소나가 없습니다. 위의 버튼을 눌러 추가해 보세요.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {personas.map((persona) => (
              <li
                key={persona.id}
                className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              >
                {editingId === persona.id ? (
                  /* 수정 폼 — 인라인 JSX로 렌더링 (중첩 컴포넌트 금지) */
                  <div className="p-4">
                    <div className="relative mb-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        maxLength={20}
                        placeholder="페르소나 이름"
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
                      />
                      <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-zinc-400">
                        {editName.length}/20
                      </span>
                    </div>
                    <div className="relative mb-2">
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        maxLength={50}
                        placeholder="이 페르소나를 한 줄로 설명해주세요"
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
                      />
                      <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-zinc-400">
                        {editDescription.length}/50
                      </span>
                    </div>
                    <div className="relative">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        maxLength={1000}
                        placeholder="페르소나 내용"
                        rows={4}
                        className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 pb-6 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
                      />
                      <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-zinc-400">
                        {editContent.length}/1000
                      </span>
                    </div>
                    {formButtons}
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{persona.name}</p>
                        {persona.is_default && (
                          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                            대표
                          </span>
                        )}
                      </div>
                      {persona.description && (
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">
                          {persona.description}
                        </p>
                      )}
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
                        {persona.content}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {!persona.is_default && (
                        <button
                          type="button"
                          onClick={() => void handleSetDefault(persona.id)}
                          disabled={busyId === persona.id}
                          className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
                        >
                          대표 설정
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => startEdit(persona)}
                        disabled={busyId === persona.id || editingId !== null}
                        className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(persona.id)}
                        disabled={busyId === persona.id}
                        className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900/60 dark:text-red-200 dark:hover:bg-red-950/30"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
