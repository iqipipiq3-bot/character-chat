"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";

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
const TIMELINE_MAX = 80;
const parseStartTurn = (turnRange: string | null | undefined): number => {
  if (!turnRange) return Number.MAX_SAFE_INTEGER;
  const match = turnRange.match(/\d+/);
  if (!match) {
    console.warn('[MemoryPanel] turn_range 파싱 실패:', turnRange);
    return Number.MAX_SAFE_INTEGER;
  }
  return Number(match[0]);
};

const getNumberMark = (index: number, total: number): string => {
  if (total <= 20) {
    return String.fromCodePoint(0x2460 + index);
  }
  return `${index + 1}.`;
};

function parseTurnStart(turnRange: string | null | undefined): number {
  if (!turnRange) return Infinity;
  const match = /^(\d+)/.exec(turnRange);
  return match ? parseInt(match[1], 10) : Infinity;
}

type RelationshipItem = {
  character_name: string;
  emotion: string;
  relationship: string;
};

function parseRelationshipJson(content: string): RelationshipItem[] {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed as RelationshipItem[];
  } catch {
    // ignore
  }
  return [];
}

// ── 툴팁 아이콘 ───────────────────────────────────────────────────────────────
function TooltipIcon({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        className="flex h-4 w-4 items-center justify-center rounded-full bg-[#E8E8E8] text-[10px] font-bold leading-none text-[#AAAAAA] hover:bg-[#DDDDDD] hover:text-[#666666]"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onClick={(e) => { e.stopPropagation(); setVisible((v) => !v); }}
        aria-label="도움말"
      >
        ?
      </button>
      {visible && (
        <span className="absolute left-0 rounded-lg bg-[#1A1A1A] px-3 py-2 leading-relaxed text-white shadow-lg" style={{ top: "calc(100% + 4px)", width: 200, maxWidth: "calc(100vw - 32px)", whiteSpace: "normal", wordBreak: "keep-all", fontSize: 12, zIndex: 9999 }}>
          {text.split("\n").map((line, i) => (
            <span key={i} className="block">{line}</span>
          ))}
        </span>
      )}
    </span>
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

function MoreHorizontalIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <circle cx="4" cy="10" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <circle cx="16" cy="10" r="1.5" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <circle cx="7" cy="5" r="1.2" /><circle cx="13" cy="5" r="1.2" />
      <circle cx="7" cy="10" r="1.2" /><circle cx="13" cy="10" r="1.2" />
      <circle cx="7" cy="15" r="1.2" /><circle cx="13" cy="15" r="1.2" />
    </svg>
  );
}

// ── 드래그 가능한 타임라인 아이템 ────────────────────────────────────────────
type SortableTimelineItemProps = {
  m: Memory;
  circle: string;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  deletingId: string | null;
  handleDelete: (id: string) => Promise<void>;
  handleSaveEdit: (id: string, content: string) => Promise<void>;
};

function SortableTimelineItem({
  m,
  circle,
  editingId,
  setEditingId,
  deletingId,
  handleDelete,
  handleSaveEdit,
}: SortableTimelineItemProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: m.id });

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: "relative",
    zIndex: isDragging ? 50 : undefined,
  };

  const parts = m.content.split("|").map((s) => s.trim());
  const turnRange = parts[0] ?? null;
  const rpDate = parts[1] ?? null;
  const titleText = parts.length >= 4 ? parts[2] : null;
  const eventContent = parts.length >= 4 ? parts.slice(3).join(" | ") : (parts[2] ?? m.content);

  void turnRange; // 정렬 키로만 사용, 화면 표시 안 함
  const metaParts = [
    rpDate && rpDate !== "알 수 없음" ? rpDate : null,
  ].filter(Boolean);
  const metaLine = metaParts.join(" · ");

  return (
    <li ref={setNodeRef} style={style} className="py-2.5">
      {editingId === m.id ? (
        (() => {
          const parsed = parseTimelineTitle(m.content);
          return (
            <TimelineForm
              initialTitle={parsed.title}
              initialBody={parsed.body}
              onSave={(content) => handleSaveEdit(m.id, content)}
              onCancel={() => setEditingId(null)}
            />
          );
        })()
      ) : (
        <div className="flex items-start gap-1.5">
          {/* 드래그 핸들 */}
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            type="button"
            className="mt-0.5 flex h-6 w-5 shrink-0 cursor-grab items-center justify-center rounded text-[#CCCCCC] hover:text-[#888888] active:cursor-grabbing"
            aria-label="순서 변경"
          >
            <GripIcon />
          </button>
          <span className="shrink-0 text-sm text-[#1A1A2E]">{circle}</span>
          <div className="min-w-0 flex-1">
            {metaLine && (
              <p className="text-[10px] text-[#AAAAAA]">{metaLine}</p>
            )}
            {titleText && (
              <p className="text-[11px] font-medium text-[#333333]">{titleText}</p>
            )}
            <p className="mt-0.5 text-[11px] leading-relaxed text-[#888888]">{eventContent}</p>
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

// ── [제목] 내용 파싱 헬퍼 ──────────────────────────────────────────────────────
function parseTimelineTitle(content: string): { title: string; body: string } {
  const match = /^\[([^\]]*)\]\s*([\s\S]*)$/.exec(content);
  if (match) return { title: match[1], body: match[2] };
  return { title: "", body: content };
}

// ── 타임라인 추가/수정 공용 폼 ────────────────────────────────────────────────
type TimelineFormProps = {
  initialTitle?: string;
  initialBody?: string;
  onSave: (content: string) => Promise<void>;
  onCancel: () => void;
};

function TimelineForm({ initialTitle = "", initialBody = "", onSave, onCancel }: TimelineFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!body.trim() || saving) return;
    setSaving(true);
    try {
      const content = title.trim()
        ? `[${title.trim()}] ${body.trim()}`
        : body.trim();
      await onSave(content);
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full rounded-lg border border-[#D0D0D0] bg-white px-3 py-1.5 text-xs text-[#1A1A1A] placeholder-[#BBBBBB] outline-none focus:border-[#1A1A2E]";

  return (
    <div className="space-y-2">
      <div>
        <label className="text-[11px] text-[#AAAAAA]">제목</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예) 첫 만남"
          maxLength={10}
          autoFocus
          className={`${inputCls} mt-1`}
        />
        <p className="mt-0.5 text-right text-[10px] text-[#CCCCCC]">{title.length}/10</p>
      </div>
      <div>
        <label className="text-[11px] text-[#AAAAAA]">내용</label>
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            const el = e.target;
            el.style.height = "auto";
            el.style.height = el.scrollHeight + "px";
          }}
          maxLength={200}
          placeholder="사건 내용을 입력하세요..."
          className="mt-1 w-full resize-none rounded-lg border border-[#D0D0D0] bg-white px-3 py-2 text-xs text-[#1A1A1A] placeholder-[#BBBBBB] outline-none focus:border-[#1A1A2E]"
          style={{ minHeight: 60 }}
          ref={(el) => {
            if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
          }}
        />
        <p className="mt-0.5 text-right text-[10px] text-[#CCCCCC]">{body.length}/200</p>
      </div>
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[#D0D0D0] px-2.5 py-1 text-[11px] text-[#888888] hover:bg-[#F5F5F5]"
        >
          취소
        </button>
        <button
          type="button"
          disabled={saving || !body.trim()}
          onClick={() => void handleSave()}
          className="rounded-lg bg-[#1A1A2E] px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
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
  const [addingSection, setAddingSection] = useState<"core_concept" | "timeline" | null>(null);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [timelineOrder, setTimelineOrder] = useState<string[]>([]);
  const [relationshipItems, setRelationshipItems] = useState<RelationshipItem[]>([]);
  const [relationshipSaving, setRelationshipSaving] = useState(false);
  const [relationshipMemoryId, setRelationshipMemoryId] = useState<string | null>(null);
  const [relationshipToast, setRelationshipToast] = useState<string | null>(null);
  const [editingCardIndex, setEditingCardIndex] = useState<number | null>(null);
  const [editingCardSnapshot, setEditingCardSnapshot] = useState<RelationshipItem | null>(null);
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openMenuIndex === null) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuIndex(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuIndex]);

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

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

  // 메모리 변경 시 timelineOrder 동기화 (기존 순서 보존, 신규 추가분 뒤에 붙임)
  useEffect(() => {
    const timelineIds = memories
      .filter((m) => m.memory_type === "timeline")
      .sort((a, b) => b.importance - a.importance)
      .map((m) => m.id);
    setTimelineOrder((prev) => {
      const prevValid = prev.filter((id) => timelineIds.includes(id));
      const newIds = timelineIds.filter((id) => !prev.includes(id));
      return [...prevValid, ...newIds];
    });
  }, [memories]);

  // relationship 메모리 → items 동기화 (파싱 실패/빈 값이면 빈 배열로 초기화)
  useEffect(() => {
    const rel = memories
      .filter((m) => m.memory_type === "relationship")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    if (rel) {
      let parsed: RelationshipItem[] = [];
      try {
        parsed = parseRelationshipJson(rel.content);
        if (!Array.isArray(parsed)) parsed = [];
      } catch {
        parsed = [];
      }
      setRelationshipItems(parsed);
      setRelationshipMemoryId(rel.id);
    } else {
      setRelationshipItems([]);
      setRelationshipMemoryId(null);
    }
  }, [memories]);

  const saveRelationshipItems = useCallback(async (items: RelationshipItem[], opts?: { toast?: boolean }) => {
    setRelationshipSaving(true);
    let ok = false;
    try {
      const nonEmpty = items.filter((it) => it.character_name.trim() || it.emotion.trim() || it.relationship.trim());
      const content = JSON.stringify(nonEmpty);

      if (nonEmpty.length === 0 && relationshipMemoryId) {
        await fetch(`/api/memories/${conversationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memory_id: relationshipMemoryId, is_active: false }),
        });
        setMemories((prev) => prev.filter((m) => m.id !== relationshipMemoryId));
        setRelationshipMemoryId(null);
        ok = true;
      } else if (nonEmpty.length === 0) {
        ok = true;
      } else if (nonEmpty.length > 0 && relationshipMemoryId) {
        await fetch(`/api/memories/${conversationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memory_id: relationshipMemoryId, content }),
        });
        setMemories((prev) => prev.map((m) => m.id === relationshipMemoryId ? { ...m, content } : m));
        ok = true;
      } else if (nonEmpty.length > 0) {
        const res = await fetch(`/api/memories/${conversationId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ character_id: characterId, memory_type: "relationship", content, importance: 3 }),
        });
        if (res.ok) {
          const json = (await res.json()) as { memory: Memory };
          setMemories((prev) => [...prev, json.memory]);
          setRelationshipMemoryId(json.memory.id);
          ok = true;
        }
      }
    } catch {
      // 실패 시 조용히 무시
    } finally {
      setRelationshipSaving(false);
      if (ok && opts?.toast) {
        setRelationshipToast("저장됨");
        setTimeout(() => setRelationshipToast(null), 1500);
      }
    }
    return ok;
  }, [conversationId, characterId, relationshipMemoryId, setMemories]);

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

  async function handleTimelineDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = timelineOrder.indexOf(active.id as string);
    const newIndex = timelineOrder.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(timelineOrder, oldIndex, newIndex);
    setTimelineOrder(newOrder);

    const total = newOrder.length;
    // 로컬 memories 즉시 반영
    setMemories((prev) =>
      prev.map((m) => {
        if (m.memory_type !== "timeline") return m;
        const pos = newOrder.indexOf(m.id);
        if (pos === -1) return m;
        return { ...m, importance: total - pos };
      })
    );

    // 서버에 병렬 저장
    await Promise.all(
      newOrder.map((id, pos) =>
        fetch(`/api/memories/${conversationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memory_id: id, importance: total - pos }),
        })
      )
    );
  }

  // ── 데이터 분류 ──────────────────────────────────────────────────────────────
  const coreConcepts = memories.filter((m) => m.memory_type === "core_concept");
  const timelineMap = new Map(
    memories.filter((m) => m.memory_type === "timeline").map((m) => [m.id, m])
  );
  const timelines = timelineOrder
    .map((id) => timelineMap.get(id))
    .filter((m): m is Memory => m !== undefined);
  const sortedTimelines = [...timelines].sort(
    (a, b) => parseStartTurn(a.turn_range) - parseStartTurn(b.turn_range)
  );
  const coreConceptFull = coreConcepts.length >= CORE_CONCEPT_MAX;
  const timelineFull = timelines.length >= TIMELINE_MAX;

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
        <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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
                    <TooltipIcon text={"이 롤플레이에서 절대 잊으면 안 되는 핵심 사건.\n연애 시작, 결혼, 죽음 등 서사의 전환점만 기록됩니다."} />
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
                    <TooltipIcon text={"턴별로 발생한 주요 사건 기록."} />
                    <span className="text-[10px] text-[#BBBBBB]">{timelines.length}/{TIMELINE_MAX}</span>
                  </div>
                  <button
                    type="button"
                    disabled={timelineFull}
                    onClick={() => !timelineFull && setAddingSection((v) => v === "timeline" ? null : "timeline")}
                    className={`flex h-5 w-5 items-center justify-center rounded transition-colors ${
                      timelineFull
                        ? "cursor-not-allowed text-[#DDDDDD]"
                        : addingSection === "timeline"
                          ? "bg-[#EBEBEB] text-[#555555]"
                          : "text-[#AAAAAA] hover:bg-[#EBEBEB] hover:text-[#555555]"
                    }`}
                    title={timelineFull ? "최대 80개까지 저장 가능합니다" : "추가"}
                  >
                    <PlusIcon />
                  </button>
                </div>

                {addingSection === "timeline" && (
                  <div className="mt-2">
                    <TimelineForm
                      onSave={(content) => handleAdd("timeline", content)}
                      onCancel={() => setAddingSection(null)}
                    />
                  </div>
                )}

                {sortedTimelines.length === 0 && addingSection !== "timeline" ? (
                  <p className="mt-2 text-[11px] text-[#CCCCCC]">아직 기억이 없습니다.</p>
                ) : (() => {
                    const PREVIEW = 5;
                    const hasMore = sortedTimelines.length > PREVIEW;
                    const visibleItems = timelineExpanded ? sortedTimelines : sortedTimelines.slice(0, PREVIEW);
                    const hiddenCount = sortedTimelines.length - PREVIEW;

                    return (
                      <DndContext
                        sensors={dndSensors}
                        onDragEnd={(e) => void handleTimelineDragEnd(e)}
                      >
                        <SortableContext
                          items={visibleItems.map((m) => m.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <ul className="mt-2 divide-y divide-[#F0F0F0]">
                            {visibleItems.map((m, visIdx) => {
                              const globalIdx = timelineExpanded
                                ? visIdx
                                : sortedTimelines.indexOf(m);
                              const circle = getNumberMark(globalIdx, sortedTimelines.length);
                              return (
                                <SortableTimelineItem
                                  key={m.id}
                                  m={m}
                                  circle={circle}
                                  editingId={editingId}
                                  setEditingId={setEditingId}
                                  deletingId={deletingId}
                                  handleDelete={handleDelete}
                                  handleSaveEdit={handleSaveEdit}
                                />
                              );
                            })}
                          </ul>
                        </SortableContext>
                        {hasMore && (
                          <button
                            type="button"
                            onClick={() => setTimelineExpanded((v) => !v)}
                            className="mt-2 w-full text-center text-[11px] text-[#AAAAAA] hover:text-[#666666]"
                          >
                            {timelineExpanded ? "접기" : `더보기 (+${hiddenCount})`}
                          </button>
                        )}
                      </DndContext>
                    );
                  })()
                }
              </section>

              {/* ── 섹션 3: 캐릭터 관계도 ── */}
              <section className="px-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[11px] font-semibold tracking-wide text-[#888888]">캐릭터 관계도</p>
                    <TooltipIcon text={"캐릭터와 유저의 관계를 직접 입력해주세요.\n매 턴 대화에 반영됩니다."} />
                  </div>
                  <div className="flex items-center gap-2">
                    {relationshipSaving && (
                      <span className="text-[10px] text-[#AAAAAA]">저장 중...</span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...relationshipItems, { character_name: "", emotion: "", relationship: "" }];
                        setRelationshipItems(next);
                        setEditingCardIndex(next.length - 1);
                        setEditingCardSnapshot(null);
                      }}
                      className="flex items-center gap-0.5 rounded-lg border border-[#D0D0D0] px-2 py-0.5 text-[11px] text-[#888888] hover:bg-[#F5F5F5]"
                    >
                      <PlusIcon />
                      <span>캐릭터 추가</span>
                    </button>
                  </div>
                </div>
                {relationshipToast && (
                  <div className="mt-2 rounded-lg bg-[#1A1A1A] px-3 py-1.5 text-center text-[11px] text-white">
                    {relationshipToast}
                  </div>
                )}

                {relationshipItems.length === 0 ? (
                  <p className="mt-2 text-[11px] text-[#CCCCCC]">아직 관계 정보가 없습니다.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {relationshipItems.map((item, idx) => {
                      const fieldCls = "w-full rounded-lg border border-[#D0D0D0] bg-white px-2.5 py-1.5 text-xs text-[#1A1A1A] placeholder-[#BBBBBB] outline-none focus:border-[#1A1A2E]";
                      const labelCls = "w-[7.5rem] shrink-0 text-[11px] text-[#AAAAAA]";
                      const isEditing = editingCardIndex === idx;

                      function updateField(field: keyof RelationshipItem, value: string) {
                        setRelationshipItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
                      }

                      if (!isEditing) {
                        const rowCls = "flex items-center gap-3";
                        const labelCls = "w-28 shrink-0 text-right text-[11px] text-[#888888]";
                        const valueCls = "text-xs font-medium text-[#1A1A1A] break-words";
                        const menuOpen = openMenuIndex === idx;
                        return (
                          <div key={idx} className="relative rounded-lg border border-[#E8E8E8] bg-[#F8F8F8] p-3 pr-8">
                            <div className="space-y-1">
                              <div className={rowCls}>
                                <span className={labelCls}>캐릭터 이름</span>
                                <span className={valueCls}>{item.character_name || "(이름 없음)"}</span>
                              </div>
                              <div className={rowCls}>
                                <span className={labelCls}>유저를 향한 감정</span>
                                <span className={valueCls}>{item.emotion || "-"}</span>
                              </div>
                              <div className={rowCls}>
                                <span className={labelCls}>캐릭터와 유저의 사이</span>
                                <span className={valueCls}>{item.relationship || "-"}</span>
                              </div>
                            </div>
                            <div ref={menuOpen ? menuRef : undefined} className="absolute top-2 right-2">
                              <button
                                type="button"
                                onClick={() => setOpenMenuIndex(menuOpen ? null : idx)}
                                className="flex h-6 w-6 items-center justify-center rounded text-[#888888] hover:bg-[#EBEBEB] hover:text-[#555555]"
                                title="메뉴"
                              >
                                <MoreHorizontalIcon />
                              </button>
                              {menuOpen && (
                                <div className="absolute right-0 mt-1 w-24 overflow-hidden rounded-lg border border-[#E0E0E0] bg-white shadow-md z-10">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuIndex(null);
                                      setEditingCardIndex(idx);
                                      setEditingCardSnapshot({ ...item });
                                    }}
                                    className="block w-full px-3 py-2 text-left text-xs text-[#1A1A1A] hover:bg-[#F5F5F5]"
                                  >
                                    편집
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuIndex(null);
                                      const next = relationshipItems.filter((_, i) => i !== idx);
                                      setRelationshipItems(next);
                                      setEditingCardIndex(null);
                                      setEditingCardSnapshot(null);
                                      void saveRelationshipItems(next);
                                    }}
                                    className="block w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50"
                                  >
                                    삭제
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={idx} className="rounded-lg border border-[#E8E8E8] bg-[#F8F8F8] px-3 py-2.5 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className={labelCls}>캐릭터 이름</span>
                            <input type="text" value={item.character_name} onChange={(e) => updateField("character_name", e.target.value)}
                              placeholder="예) 철수" maxLength={50} className={fieldCls} />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={labelCls}>유저를 향한 감정</span>
                            <input type="text" value={item.emotion} onChange={(e) => updateField("emotion", e.target.value)}
                              placeholder="예) 집착하는 사랑" maxLength={50} className={fieldCls} />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={labelCls}>캐릭터와 유저의 사이</span>
                            <input type="text" value={item.relationship} onChange={(e) => updateField("relationship", e.target.value)}
                              placeholder="예) 연인" maxLength={50} className={fieldCls} />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                const ok = await saveRelationshipItems(relationshipItems, { toast: true });
                                if (ok) {
                                  setEditingCardIndex(null);
                                  setEditingCardSnapshot(null);
                                }
                              }}
                              disabled={relationshipSaving}
                              className="rounded-lg border border-[#1A1A2E] bg-[#1A1A2E] px-2 py-0.5 text-[11px] text-white hover:bg-[#2A2A3E] disabled:opacity-50"
                            >
                              저장
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (editingCardSnapshot) {
                                  setRelationshipItems((prev) => prev.map((it, i) => i === idx ? editingCardSnapshot : it));
                                } else {
                                  // 새로 추가된 카드 취소 → 제거
                                  setRelationshipItems((prev) => prev.filter((_, i) => i !== idx));
                                }
                                setEditingCardIndex(null);
                                setEditingCardSnapshot(null);
                              }}
                              className="rounded-lg border border-[#D0D0D0] px-2 py-0.5 text-[11px] text-[#888888] hover:bg-[#F5F5F5]"
                            >
                              취소
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const next = relationshipItems.filter((_, i) => i !== idx);
                                setRelationshipItems(next);
                                setEditingCardIndex(null);
                                setEditingCardSnapshot(null);
                                void saveRelationshipItems(next);
                              }}
                              className="rounded-lg px-2 py-0.5 text-[11px] text-[#AAAAAA] hover:bg-red-50 hover:text-red-500"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

            </div>
          )}
        </div>
      </div>
    </>
  );
}
