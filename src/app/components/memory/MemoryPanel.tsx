"use client";

import { useState, useEffect, useCallback } from "react";

export type Memory = {
  id: string;
  memory_type: "core_concept" | "timeline" | "relationship" | string;
  content: string;
  importance: number;
  source: "ai" | "user" | string;
  rp_date?: string | null;
  turn_range?: string | null;
  created_at: string;
  updated_at?: string;
};

type Props = {
  conversationId: string;
  characterId: string;
  characterName?: string;
  isOpen: boolean;
  onClose: () => void;
};

const CORE_CONCEPT_MAX = 5;
const CIRCLE_NUMBERS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

function parseTurnStart(turnRange: string | null | undefined): number {
  if (!turnRange) return Infinity;
  const match = /^(\d+)/.exec(turnRange);
  return match ? parseInt(match[1], 10) : Infinity;
}

// content.split('\n')으로 줄 나누고 ':' 뒤 값 추출
function parseRelationshipContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();
    if (key && val) result[key] = val;
  }
  return result;
}

// ── 관계도 추가/수정 폼 ──────────────────────────────────────────────────────
type RelationshipFormProps = {
  initialCharName?: string;
  initialCharToUser?: string;
  initialUserToChar?: string;
  initialEmotion?: string;
  onSave: (content: string) => Promise<void>;
  onCancel: () => void;
};

function RelationshipForm({
  initialCharName = "",
  initialCharToUser = "",
  initialUserToChar = "",
  initialEmotion = "",
  onSave,
  onCancel,
}: RelationshipFormProps) {
  const [charName, setCharName] = useState(initialCharName);
  const [charToUser, setCharToUser] = useState(initialCharToUser);
  const [userToChar, setUserToChar] = useState(initialUserToChar);
  const [emotion, setEmotion] = useState(initialEmotion);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!charName.trim() || saving) return;
    setSaving(true);
    try {
      const content = `character_name:${charName.trim()}\n캐릭터는 유저에게:${charToUser.trim()}\n유저는 캐릭터에게:${userToChar.trim()}\n유저를 향한 감정:${emotion.trim()}`;
      await onSave(content);
    } finally {
      setSaving(false);
    }
  }

  const fieldCls = "w-full rounded-lg border border-[#D0D0D0] bg-white px-3 py-1.5 text-xs text-[#1A1A1A] placeholder-[#BBBBBB] outline-none focus:border-[#1A1A2E]";
  const labelCls = "w-24 shrink-0 text-[11px] text-[#AAAAAA]";

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className={labelCls}>캐릭터 이름</span>
        <input type="text" value={charName} onChange={(e) => setCharName(e.target.value)}
          placeholder="이름 입력" autoFocus maxLength={50} className={fieldCls} />
      </div>
      <div className="flex items-center gap-2">
        <span className={labelCls}>캐릭터→유저</span>
        <input type="text" value={charToUser} onChange={(e) => setCharToUser(e.target.value)}
          placeholder="캐릭터는 유저에게 어떤 사람?" maxLength={100} className={fieldCls} />
      </div>
      <div className="flex items-center gap-2">
        <span className={labelCls}>유저→캐릭터</span>
        <input type="text" value={userToChar} onChange={(e) => setUserToChar(e.target.value)}
          placeholder="유저는 캐릭터에게 어떤 사람?" maxLength={100} className={fieldCls} />
      </div>
      <div className="flex items-center gap-2">
        <span className={labelCls}>유저를 향한 감정</span>
        <input type="text" value={emotion} onChange={(e) => setEmotion(e.target.value)}
          placeholder="감정 입력" maxLength={100} className={fieldCls} />
      </div>
      <div className="flex justify-end gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[#D0D0D0] px-2.5 py-1 text-[11px] text-[#888888] hover:bg-[#F5F5F5]"
        >
          취소
        </button>
        <button
          type="button"
          disabled={saving || !charName.trim()}
          onClick={() => void handleSave()}
          className="rounded-lg bg-[#1A1A2E] px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}

// ── 아이콘 ────────────────────────────────────────────────────────────────────
function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

// ── 인라인 추가 폼 ─────────────────────────────────────────────────────────────
type InlineAddFormProps = {
  onSave: (content: string) => Promise<void>;
  onCancel: () => void;
  placeholder?: string;
};

function InlineAddForm({ onSave, onCancel, placeholder = "내용을 입력하세요..." }: InlineAddFormProps) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!value.trim() || saving) return;
    setSaving(true);
    try {
      await onSave(value.trim());
      setValue("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 space-y-1.5">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        maxLength={300}
        placeholder={placeholder}
        autoFocus
        className="w-full resize-none rounded-lg border border-[#D0D0D0] bg-white px-3 py-2 text-xs text-[#1A1A1A] placeholder-[#BBBBBB] outline-none focus:border-[#1A1A2E]"
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#CCCCCC]">{value.length}/300</span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[#D0D0D0] px-2.5 py-1 text-[11px] text-[#888888] hover:bg-[#F5F5F5]"
          >
            취소
          </button>
          <button
            type="button"
            disabled={saving || !value.trim()}
            onClick={() => void handleSave()}
            className="rounded-lg bg-[#1A1A2E] px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 인라인 수정 폼 ─────────────────────────────────────────────────────────────
type InlineEditFormProps = {
  initialValue: string;
  onSave: (content: string) => Promise<void>;
  onCancel: () => void;
};

function InlineEditForm({ initialValue, onSave, onCancel }: InlineEditFormProps) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!value.trim() || saving) return;
    setSaving(true);
    try {
      await onSave(value.trim());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        maxLength={300}
        autoFocus
        className="w-full resize-none rounded-lg border border-[#D0D0D0] bg-white px-3 py-2 text-xs text-[#1A1A1A] outline-none focus:border-[#1A1A2E]"
      />
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={saving || !value.trim()}
          onClick={() => void handleSave()}
          className="rounded-lg bg-[#1A1A2E] px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[#D0D0D0] px-2.5 py-1 text-[11px] text-[#888888] hover:bg-[#F5F5F5]"
        >
          취소
        </button>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export function MemoryPanel({ conversationId, characterId, characterName, isOpen, onClose }: Props) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addingSection, setAddingSection] = useState<"core_concept" | "timeline" | "relationship" | null>(null);

  const fetchMemories = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/memories/${conversationId}`);
      if (!res.ok) {
        if (res.status === 400) { console.warn("[MemoryPanel] 400:", res.status); return; }
        throw new Error(`HTTP ${res.status}`);
      }
      const json = (await res.json()) as { memories: Memory[] };
      setMemories(json.memories ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (isOpen && conversationId) void fetchMemories();
  }, [isOpen, conversationId, fetchMemories]);

  // ── API 액션 ────────────────────────────────────────────────────────────────
  async function handleAdd(type: string, content: string) {
    const res = await fetch(`/api/memories/${conversationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ character_id: characterId, memory_type: type, content, importance: 3 }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { memory: Memory };
    setMemories((prev) => [...prev, json.memory]);
    setAddingSection(null);
  }

  async function handleSaveEdit(id: string, content: string) {
    const res = await fetch(`/api/memories/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memory_id: id, content }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setMemories((prev) => prev.map((m) => (m.id === id ? { ...m, content } : m)));
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/memories/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memory_id: id, is_active: false }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  // ── 데이터 분류 ──────────────────────────────────────────────────────────────
  const coreConcepts = memories.filter((m) => m.memory_type === "core_concept");
  const timelines = memories
    .filter((m) => m.memory_type === "timeline")
    .sort((a, b) => parseTurnStart(a.turn_range) - parseTurnStart(b.turn_range));
  // character_name 기준 최신 1개만 표시 (히스토리 허용, 표시는 최신만)
  const relationships = (() => {
    const all = memories
      .filter((m) => m.memory_type === "relationship")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const seen = new Set<string>();
    const result: Memory[] = [];
    for (const m of all) {
      const parsed = parseRelationshipContent(m.content);
      const charKey = (parsed["character_name"] ?? "").trim() || m.id;
      if (!seen.has(charKey)) {
        seen.add(charKey);
        result.push(m);
      }
    }
    return result;
  })();

  const coreConceptFull = coreConcepts.length >= CORE_CONCEPT_MAX;

  return (
    <>
      {/* 백드롭 */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      {/* 패널 */}
      <div
        className={`fixed right-0 top-12 bottom-0 z-50 flex w-80 flex-col border-l border-[#E0E0E0] bg-white shadow-xl transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* 헤더 */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#E0E0E0] px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[#1A1A1A]">장기 기억</h2>
            {memories.length > 0 && (
              <span className="rounded-full bg-[#F0F0F0] px-2 py-0.5 text-[10px] font-medium text-[#666666]">
                {memories.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void fetchMemories()}
              disabled={loading}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[#AAAAAA] hover:bg-[#F0F0F0] hover:text-[#555555] disabled:opacity-40"
              title="새로고침"
            >
              <svg className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[#AAAAAA] hover:bg-[#F0F0F0] hover:text-[#555555]"
            >
              <XIcon />
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="mx-4 mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
          )}
          {loading && !error && (
            <div className="flex items-center justify-center py-12 text-xs text-[#AAAAAA]">불러오는 중...</div>
          )}

          {!loading && (
            <div className="divide-y divide-[#F0F0F0]">

              {/* ── 섹션 1: 절대 기억 ── */}
              <section className="px-4 py-4">
                {/* 헤더 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[11px] font-semibold tracking-wide text-[#888888]">절대 기억</p>
                    <span className="text-[10px] text-[#BBBBBB]">{coreConcepts.length}/{CORE_CONCEPT_MAX}</span>
                  </div>
                  <button
                    type="button"
                    disabled={coreConceptFull}
                    onClick={() => !coreConceptFull && setAddingSection((v) => v === "core_concept" ? null : "core_concept")}
                    className={`flex h-5 w-5 items-center justify-center rounded transition-colors ${
                      coreConceptFull
                        ? "cursor-not-allowed text-[#DDDDDD]"
                        : addingSection === "core_concept"
                          ? "bg-[#EBEBEB] text-[#555555]"
                          : "text-[#AAAAAA] hover:bg-[#EBEBEB] hover:text-[#555555]"
                    }`}
                    title={coreConceptFull ? "최대 5개까지 저장 가능합니다" : "추가"}
                  >
                    <PlusIcon />
                  </button>
                </div>

                {addingSection === "core_concept" && (
                  <InlineAddForm
                    placeholder="절대 잊지 말아야 할 기억을 입력하세요..."
                    onSave={(content) => handleAdd("core_concept", content)}
                    onCancel={() => setAddingSection(null)}
                  />
                )}

                {coreConcepts.length === 0 && addingSection !== "core_concept" ? (
                  <p className="mt-2 text-[11px] text-[#CCCCCC]">아직 기억이 없습니다.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {coreConcepts.map((m) => (
                      <li
                        key={m.id}
                        className="rounded-lg border border-[#E8E8E8] bg-[#F8F8F8] px-3 py-2.5"
                      >
                        {editingId === m.id ? (
                          <InlineEditForm
                            initialValue={m.content}
                            onSave={(content) => handleSaveEdit(m.id, content)}
                            onCancel={() => setEditingId(null)}
                          />
                        ) : (
                          <div className="flex items-start gap-2">
                            <p className="min-w-0 flex-1 text-xs leading-relaxed text-[#333333]">{m.content}</p>
                            <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
                              <button
                                type="button"
                                onClick={() => setEditingId(m.id)}
                                className="flex h-6 w-6 items-center justify-center rounded text-[#AAAAAA] hover:bg-[#EBEBEB] hover:text-[#555555]"
                                title="수정"
                              >
                                <PencilIcon />
                              </button>
                              <button
                                type="button"
                                disabled={deletingId === m.id}
                                onClick={() => void handleDelete(m.id)}
                                className="flex h-6 w-6 items-center justify-center rounded text-[#AAAAAA] hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                                title="삭제"
                              >
                                {deletingId === m.id ? <span className="text-[10px]">...</span> : <XIcon />}
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* ── 섹션 2: 사건 타임라인 ── */}
              <section className="px-4 py-4">
                {/* 헤더 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[11px] font-semibold tracking-wide text-[#888888]">사건 타임라인</p>
                    {timelines.length > 0 && (
                      <span className="rounded-full bg-[#EBEBEB] px-1.5 py-0.5 text-[10px] font-medium text-[#888888]">
                        {timelines.length}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setAddingSection((v) => v === "timeline" ? null : "timeline")}
                    className={`flex h-5 w-5 items-center justify-center rounded transition-colors ${
                      addingSection === "timeline"
                        ? "bg-[#EBEBEB] text-[#555555]"
                        : "text-[#AAAAAA] hover:bg-[#EBEBEB] hover:text-[#555555]"
                    }`}
                    title="추가"
                  >
                    <PlusIcon />
                  </button>
                </div>

                {addingSection === "timeline" && (
                  <InlineAddForm
                    placeholder="사건 내용을 입력하세요... (예: 1-5 | 3월 15일 | 처음 만난 날)"
                    onSave={(content) => handleAdd("timeline", content)}
                    onCancel={() => setAddingSection(null)}
                  />
                )}

                {timelines.length === 0 && addingSection !== "timeline" ? (
                  <p className="mt-2 text-[11px] text-[#CCCCCC]">아직 기억이 없습니다.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-[#F0F0F0]">
                    {timelines.map((m, idx) => {
                      const circle = CIRCLE_NUMBERS[idx] ?? `(${idx + 1})`;
                      // content에서 날짜·사건 파싱: "[turn] | [date] | [사건]" 또는 그냥 전체
                      const parts = m.content.split("|").map((s) => s.trim());
                      const dateLabel = parts.length >= 2 ? parts[1] : null;
                      const eventLabel = parts.length >= 3 ? parts.slice(2).join(" | ") : m.content;

                      return (
                        <li key={m.id} className="py-2.5">
                          {editingId === m.id ? (
                            <InlineEditForm
                              initialValue={m.content}
                              onSave={(content) => handleSaveEdit(m.id, content)}
                              onCancel={() => setEditingId(null)}
                            />
                          ) : (
                            <div className="flex items-start gap-2">
                              <span className="shrink-0 text-sm text-[#1A1A2E]">{circle}</span>
                              <div className="min-w-0 flex-1">
                                {dateLabel && dateLabel !== "알 수 없음" && (
                                  <span className="text-[10px] text-[#AAAAAA]"> — {dateLabel} — </span>
                                )}
                                <span className="text-xs leading-relaxed text-[#333333]">{eventLabel}</span>
                              </div>
                              <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingId(m.id)}
                                  className="flex h-6 w-6 items-center justify-center rounded text-[#AAAAAA] hover:bg-[#EBEBEB] hover:text-[#555555]"
                                  title="수정"
                                >
                                  <PencilIcon />
                                </button>
                                <button
                                  type="button"
                                  disabled={deletingId === m.id}
                                  onClick={() => void handleDelete(m.id)}
                                  className="flex h-6 w-6 items-center justify-center rounded text-[#AAAAAA] hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                                  title="삭제"
                                >
                                  {deletingId === m.id ? <span className="text-[10px]">...</span> : <XIcon />}
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* ── 섹션 3: 캐릭터 관계도 ── */}
              <section className="px-4 py-4">
                {/* 헤더 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[11px] font-semibold tracking-wide text-[#888888]">캐릭터 관계도</p>
                    {relationships.length > 0 && (
                      <span className="rounded-full bg-[#EBEBEB] px-1.5 py-0.5 text-[10px] font-medium text-[#888888]">
                        {relationships.length}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setAddingSection((v) => v === "relationship" ? null : "relationship")}
                    className={`flex h-5 w-5 items-center justify-center rounded transition-colors ${
                      addingSection === "relationship"
                        ? "bg-[#EBEBEB] text-[#555555]"
                        : "text-[#AAAAAA] hover:bg-[#EBEBEB] hover:text-[#555555]"
                    }`}
                    title="추가"
                  >
                    <PlusIcon />
                  </button>
                </div>

                {/* 추가 폼 */}
                {addingSection === "relationship" && (
                  <RelationshipForm
                    onSave={(content) => handleAdd("relationship", content)}
                    onCancel={() => setAddingSection(null)}
                  />
                )}

                {/* 목록 */}
                {relationships.length === 0 && addingSection !== "relationship" ? (
                  <p className="mt-2 text-[11px] text-[#CCCCCC]">아직 기억이 없습니다.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-[#F0F0F0]">
                    {relationships.map((m) => {
                      const parsed = parseRelationshipContent(m.content);
                      const charNameParsed = parsed["character_name"] ?? "";
                      const charToUser = parsed["캐릭터는 유저에게"] ?? "";
                      const userToChar = parsed["유저는 캐릭터에게"] ?? "";
                      const emotion = parsed["유저를 향한 감정"] ?? "";

                      return (
                        <li key={m.id} className="py-2.5">
                          {editingId === m.id ? (
                            <RelationshipForm
                              initialCharName={charNameParsed}
                              initialCharToUser={charToUser}
                              initialUserToChar={userToChar}
                              initialEmotion={emotion}
                              onSave={(content) => handleSaveEdit(m.id, content)}
                              onCancel={() => setEditingId(null)}
                            />
                          ) : (
                            <div className="relative">
                              {/* 수정/삭제 */}
                              <div className="absolute right-0 top-0 flex items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingId(m.id)}
                                  className="flex h-6 w-6 items-center justify-center rounded text-[#AAAAAA] hover:bg-[#EBEBEB] hover:text-[#555555]"
                                  title="수정"
                                >
                                  <PencilIcon />
                                </button>
                                <button
                                  type="button"
                                  disabled={deletingId === m.id}
                                  onClick={() => void handleDelete(m.id)}
                                  className="flex h-6 w-6 items-center justify-center rounded text-[#AAAAAA] hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                                  title="삭제"
                                >
                                  {deletingId === m.id ? <span className="text-[10px]">...</span> : <XIcon />}
                                </button>
                              </div>

                              {/* 플랫 표시 */}
                              <dl className="space-y-1 pr-14">
                                <div className="flex gap-1.5">
                                  <dt className="shrink-0 text-[11px] text-[#AAAAAA]">캐릭터 이름:</dt>
                                  <dd className="text-[11px] font-medium text-[#1A1A1A]">{charNameParsed || "—"}</dd>
                                </div>
                                <div className="mt-1 text-[11px] text-[#AAAAAA]">유저와의 관계</div>
                                {charToUser && (
                                  <div className="flex gap-1.5 pl-2">
                                    <dt className="shrink-0 text-[11px] text-[#AAAAAA]">캐릭터는 유저에게:</dt>
                                    <dd className="text-[11px] text-[#333333]">{charToUser}</dd>
                                  </div>
                                )}
                                {userToChar && (
                                  <div className="flex gap-1.5 pl-2">
                                    <dt className="shrink-0 text-[11px] text-[#AAAAAA]">유저는 캐릭터에게:</dt>
                                    <dd className="text-[11px] text-[#333333]">{userToChar}</dd>
                                  </div>
                                )}
                                {emotion && (
                                  <div className="flex gap-1.5">
                                    <dt className="shrink-0 text-[11px] text-[#AAAAAA]">유저를 향한 감정:</dt>
                                    <dd className="text-[11px] text-[#333333]">{emotion}</dd>
                                  </div>
                                )}
                                {!charToUser && !userToChar && !emotion && (
                                  <dd className="text-[11px] text-[#333333]">{m.content}</dd>
                                )}
                              </dl>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

            </div>
          )}
        </div>
      </div>
    </>
  );
}
