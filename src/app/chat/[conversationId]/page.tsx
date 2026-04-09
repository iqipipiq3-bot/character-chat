"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "../../lib/supabase";
import { useHeaderStore } from "../../context/HeaderContext";
import type { Components } from "react-markdown";
import React from "react";
import { MarkdownRenderer } from "../../components/MarkdownRenderer";
import {
  ChatSidePanel,
  DEFAULT_AI_BUBBLE_BG,
  DEFAULT_FONT_SETTINGS,
  type FontSettings,
  type Persona,
} from "./ChatSidePanel";
import { MemoryPanel } from "../../components/memory/MemoryPanel";
import { replaceVariables } from "../../lib/replaceVariables";

type Message = {
  id: string;
  role: "user" | "assistant" | "loading";
  content: string;
  created_at: string;
  model?: string | null;
};

function ModelHeartIcon({ model }: { model?: string | null }) {
  const color = model === "gemini-3.1-pro-preview" ? "#FF6B00" : "#FF0000";
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 21.593c-.525-.507-5.453-5.017-7.005-6.938C2.464 11.977 2 10.025 2 8.196 2 4.771 4.812 2 8.286 2c1.773 0 3.416.808 4.714 2.136C14.298 2.808 15.941 2 17.714 2 21.188 2 24 4.771 24 8.196c0 1.83-.464 3.78-2.995 6.459-1.552 1.921-6.48 6.431-7.005 6.938l-1 .948-1-.948z" />
    </svg>
  );
}

function TypingIndicator() {
  return (
    <div className="inline-flex gap-1 items-center px-4 py-3">
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

const ALLOWED_MODELS = ["gemini-2.5-pro", "gemini-3.1-pro-preview"] as const;
type ModelId = (typeof ALLOWED_MODELS)[number];

const CHAT_MODELS: { value: ModelId; label: string; heartColor: string }[] = [
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", heartColor: "#FF0000" },
  { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", heartColor: "#FF6B00" },
];
const LEGACY_DEFAULT_AI_BUBBLE_BG = "#FFFFFF";

function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (React.isValidElement(node))
    return extractText((node.props as { children?: React.ReactNode }).children);
  return "";
}

function CodeBlock({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  const [copied, setCopied] = useState(false);

  let lang = "";
  let codeText = "";

  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child)) {
      const props = child.props as { className?: string; children?: React.ReactNode };
      if (props.className?.startsWith("language-")) {
        lang = props.className.replace("language-", "");
      }
      codeText = extractText(props.children).replace(/\n$/, "");
    }
  });

  function handleCopy() {
    void navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const bg = light ? "#f0f0f0" : "#2d2d2d";
  const headerBg = light ? "#e4e4e4" : "#252525";
  const textColor = light ? "#333333" : "#e0e0e0";
  const metaColor = light ? "#888888" : "#aaaaaa";
  const copiedColor = light ? "#16a34a" : "#4ade80";

  return (
    <div style={{ background: bg, borderRadius: "8px", margin: "8px 0", overflow: "hidden" }}>
      {lang && (
        <div
          style={{
            background: headerBg,
            padding: "3px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              color: metaColor,
              fontSize: "0.875rem",
              fontFamily: "inherit",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {lang}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              color: copied ? copiedColor : metaColor,
              fontSize: "0.875rem",
              fontFamily: "inherit",
              background: "none",
              border: "none",
              cursor: "pointer",
              transition: "color 0.2s",
            }}
          >
            {copied ? "복사됨 ✓" : "복사"}
          </button>
        </div>
      )}
      <pre style={{ margin: 0, padding: "7px 14px 15px" }}>
        <code
          style={{
            display: "block",
            color: textColor,
            fontFamily: "inherit",
            fontSize: "0.85rem",
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {codeText}
        </code>
      </pre>
    </div>
  );
}

const userMdComponents: Components = {
  em: ({ children }) => (
    <em style={{ color: "#555555", fontStyle: "normal" }}>{children}</em>
  ),
  strong: ({ children }) => (
    <strong style={{ fontWeight: 700 }}>{children}</strong>
  ),
  p: ({ children }) => <p className="my-3 break-words">{children}</p>,
  code: ({ children, className }) => {
    if (className?.startsWith("language-")) {
      return <code className={className}>{children}</code>;
    }
    return (
      <code style={{ background: "#ddd8d0", color: "#333333", padding: "2px 5px", borderRadius: "4px", fontFamily: "inherit", fontSize: "0.85em" }}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => <CodeBlock light>{children}</CodeBlock>,
};

const aiMdComponents: Components = {
  em: ({ children }) => (
    <em style={{ color: "#888888", fontStyle: "normal" }}>{children}</em>
  ),
  strong: ({ children }) => (
    <strong style={{ fontWeight: 700 }}>{children}</strong>
  ),
  p: ({ children }) => <p className="my-3 break-words">{children}</p>,
  code: ({ children, className }) => {
    if (className?.startsWith("language-")) {
      return <code className={className}>{children}</code>;
    }
    return (
      <code style={{ background: "#f0f0f0", color: "#c7254e", padding: "2px 5px", borderRadius: "4px", fontFamily: "inherit", fontSize: "0.85em" }}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
};

export default function ChatPage() {
  const router = useRouter();
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;
  const searchParams = useSearchParams();

  const [characterId, setCharacterId] = useState<string | null>(null);
  const [characterName, setCharacterName] = useState<string | null>(null);
  const [characterThumbnail, setCharacterThumbnail] = useState<string | null>(null);
  const [characterRecommendedModel, setCharacterRecommendedModel] = useState<ModelId>("gemini-2.5-pro");
  const [profileNickname, setProfileNickname] = useState<string>("");

  // 사이드 패널
  const [sidePanelOpen, setSidePanelOpen] = useState(false);

  // 기억 패널
  const [memoryPanelOpen, setMemoryPanelOpen] = useState(false);
  const [memoryCount, setMemoryCount] = useState(0);

  useEffect(() => {
    if (!conversationId) return;
    fetch(`/api/memories/${conversationId}`)
      .then((r) => r.json())
      .then((json: { memories?: unknown[] }) => setMemoryCount(json.memories?.length ?? 0))
      .catch(() => {});
  }, [conversationId]);

  // 모델 선택
  const [selectedModel, setSelectedModel] = useState<ModelId>("gemini-2.5-pro");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const conversationModelRef = useRef<string | null>(null);

  // 페르소나
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);

  // 유저 노트
  const [userNote, setUserNote] = useState("");

  // 글꼴 설정
  const [fontSettings, setFontSettings] = useState<FontSettings>(DEFAULT_FONT_SETTINGS);

  // localStorage 초기화 (페르소나·노트·폰트)
  useEffect(() => {
    const savedPersonaId = localStorage.getItem("chat_active_persona_id");
    setActivePersonaId(savedPersonaId ?? null);
    setUserNote(localStorage.getItem(`chat_user_note_${conversationId}`) ?? "");
    const savedFont = localStorage.getItem("chat_font_settings");
    if (savedFont) {
      try {
        const parsed = JSON.parse(savedFont) as Partial<FontSettings>;
        const nextFontSettings: FontSettings = {
          ...DEFAULT_FONT_SETTINGS,
          ...parsed,
          aiBubbleBg: parsed.aiBubbleBg === LEGACY_DEFAULT_AI_BUBBLE_BG ? DEFAULT_AI_BUBBLE_BG : (parsed.aiBubbleBg ?? DEFAULT_FONT_SETTINGS.aiBubbleBg),
        };
        setFontSettings(nextFontSettings);
        localStorage.setItem("chat_font_settings", JSON.stringify(nextFontSettings));
      } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 모델 변경 핸들러 — conversations 테이블에 저장
  async function handleModelChange(model: ModelId) {
    setSelectedModel(model);
    setModelMenuOpen(false);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.from("conversations").update({ model }).eq("id", conversationId);
    } catch { /* ignore — state already updated */ }
  }

  // 페르소나 선택 핸들러
  function handleSelectPersona(id: string | null) {
    setActivePersonaId(id);
    if (id) localStorage.setItem("chat_active_persona_id", id);
    else localStorage.removeItem("chat_active_persona_id");
  }

  // 유저 노트 변경 핸들러
  function handleUserNoteChange(note: string) {
    setUserNote(note);
    localStorage.setItem(`chat_user_note_${conversationId}`, note);
  }

  // 글꼴 설정 변경 핸들러
  function handleFontSettingsChange(s: FontSettings) {
    setFontSettings(s);
    localStorage.setItem("chat_font_settings", JSON.stringify(s));
  }

  useEffect(() => {
    async function loadConversation() {
      const supabase = createSupabaseBrowserClient();
      const characterIdFromQuery = searchParams.get("characterId");
      const { data, error } = await supabase
        .from("conversations")
        .select("character_id, model")
        .eq("id", conversationId)
        .maybeSingle();

      if (error) {
        setError("대화를 불러올 수 없습니다.");
        return;
      }

      if (!data) {
        // 아직 대화방이 없다면 새로 생성합니다 (대시보드에서 처음 진입한 경우 등).
        try {
          const {
            data: { user },
            error: userError,
          } = await supabase.auth.getUser();

          if (userError || !user) {
            setError("대화를 불러올 수 없습니다.");
            return;
          }

          // character_id는 우선 쿼리스트링에서, 없으면 URL 파라미터(conversationId)를 사용합니다.
          const newCharacterId = characterIdFromQuery ?? (conversationId as string | null);

          if (!newCharacterId) {
            setError("대화를 불러올 수 없습니다.");
            return;
          }

          // 중복 생성을 피하기 위해 upsert + onConflict 사용
          const insertPayload = {
            id: conversationId,
            user_id: user.id,
            character_id: newCharacterId,
          };
          const { error: insertError } = await supabase
            .from("conversations")
            .upsert(insertPayload, { onConflict: "id", ignoreDuplicates: true });

          if (insertError) {
            setError("대화를 불러올 수 없습니다.");
            return;
          }

          setCharacterId(newCharacterId);
          return;
        } catch {
          setError("대화를 불러올 수 없습니다.");
          return;
        }
      }

      conversationModelRef.current = (data as { character_id: string; model?: string | null }).model ?? null;
      setCharacterId(data.character_id);
    }
    if (conversationId) void loadConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // 캐릭터 이름 + 페르소나 목록 로드
  useEffect(() => {
    if (!characterId) return;
    async function loadCharacterAndPersonas() {
      const supabase = createSupabaseBrowserClient();
      const [{ data: char }, { data: { user } }] = await Promise.all([
        supabase.from("characters").select("name, thumbnail_url, recommended_model").eq("id", characterId!).maybeSingle(),
        supabase.auth.getUser(),
      ]);
      setCharacterName((char?.name as string | null) ?? null);
      setCharacterThumbnail((char?.thumbnail_url as string | null) ?? null);
      const recModel = (char?.recommended_model as string | null) ?? "gemini-2.5-pro";
      if (ALLOWED_MODELS.includes(recModel as ModelId)) {
        setCharacterRecommendedModel(recModel as ModelId);
      }
      // 모델 우선순위: 1) conversations.model  2) character.recommended_model  3) 기본값
      const convModel = conversationModelRef.current;
      const modelToUse: ModelId =
        convModel && ALLOWED_MODELS.includes(convModel as ModelId)
          ? (convModel as ModelId)
          : ALLOWED_MODELS.includes(recModel as ModelId)
            ? (recModel as ModelId)
            : "gemini-2.5-pro";
      setSelectedModel(modelToUse);
      if (!user) return;
      const [{ data: personaData }, { data: profileData }] = await Promise.all([
        supabase.from("personas").select("id, name, content, is_default").eq("user_id", user.id).order("created_at", { ascending: true }),
        supabase.from("profiles").select("nickname").eq("user_id", user.id).maybeSingle(),
      ]);
      setPersonas((personaData ?? []) as Persona[]);
      setProfileNickname((profileData?.nickname as string | null) ?? "");
    }
    void loadCharacterAndPersonas();
  }, [characterId]);

  // {{user}} 치환용 유저 이름: 활성 페르소나 name → 기본 페르소나 name → 프로필 닉네임 → "유저"
  const userName = (() => {
    if (activePersonaId) {
      const p = personas.find((p) => p.id === activePersonaId);
      if (p?.name) return p.name;
    }
    const def = personas.find((p) => p.is_default);
    if (def?.name) return def.name;
    return profileNickname || "유저";
  })();

  // 모델 드롭다운 바깥 클릭 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setModelMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { updateCredits } = useHeaderStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const oldestCreatedAtRef = useRef<string | null>(null);
  const PAGE_SIZE = 30;

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const streamingReaderRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  // 컨텍스트 메뉴 닫기 (다른 곳 클릭 / 스크롤 / Escape)
  useEffect(() => {
    if (!contextMenu) return;
    function handleClose() { setContextMenu(null); }
    function handleKeyDown(e: KeyboardEvent) { if (e.key === "Escape") setContextMenu(null); }
    document.addEventListener("click", handleClose);
    document.addEventListener("scroll", handleClose, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleClose);
      document.removeEventListener("scroll", handleClose, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  useEffect(() => {
    async function loadMessages() {
      const supabase = createSupabaseBrowserClient();
      const { data, error: fetchError } = await supabase
        .from("messages")
        .select("id, role, content, created_at, model")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (fetchError) {
        // model 컬럼 누락 에러 무시하고 model 없이 재시도
        if (fetchError.message.includes("model")) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from("messages")
            .select("id, role, content, created_at")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: false })
            .limit(PAGE_SIZE);
          if (fallbackError) { setError(fallbackError.message); return; }
          const fallbackMsgs = ((fallbackData ?? []) as Message[]).reverse();
          setMessages(fallbackMsgs);
          setHasMore(fallbackMsgs.length >= PAGE_SIZE);
          if (fallbackMsgs.length > 0) {
            oldestCreatedAtRef.current = fallbackMsgs[0].created_at;
          }
          requestAnimationFrame(() => {
            if (fallbackMsgs.length === 0) {
              window.scrollTo({ top: 0, behavior: "instant" });
            } else {
              bottomRef.current?.scrollIntoView({ behavior: "instant" });
            }
          });
          return;
        }
        setError(fetchError.message);
        return;
      }

      const msgs = ((data ?? []) as Message[]).reverse();
      setMessages(msgs);
      setHasMore(msgs.length >= PAGE_SIZE);
      if (msgs.length > 0) {
        oldestCreatedAtRef.current = msgs[0].created_at;
      }
      requestAnimationFrame(() => {
        if (msgs.length === 0) {
          window.scrollTo({ top: 0, behavior: "instant" });
        } else {
          bottomRef.current?.scrollIntoView({ behavior: "instant" });
        }
      });
    }

    if (conversationId) {
      void loadMessages();
    }
  }, [conversationId]);

  // 이전 메시지 추가 로딩
  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || !hasMore || !oldestCreatedAtRef.current) return;
    setIsLoadingMore(true);

    const prevScrollHeight = document.documentElement.scrollHeight;

    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("messages")
        .select("id, role, content, created_at, model")
        .eq("conversation_id", conversationId)
        .lt("created_at", oldestCreatedAtRef.current)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (!data || data.length === 0) {
        setHasMore(false);
        return;
      }

      const older = (data as Message[]).reverse();
      oldestCreatedAtRef.current = older[0].created_at;
      if (data.length < PAGE_SIZE) setHasMore(false);

      setMessages((prev) => [...older, ...prev]);

      requestAnimationFrame(() => {
        const newScrollHeight = document.documentElement.scrollHeight;
        window.scrollBy(0, newScrollHeight - prevScrollHeight);
      });
    } catch {
      // 네트워크 에러 시 조용히 무시 — 다음 스크롤에서 재시도
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, conversationId]);

  // 유저 스크롤 감지: 올리면 isUserScrolling=true, 맨 아래 도달하면 false + 상단 감지
  useEffect(() => {
    function handleScroll() {
      const el = document.documentElement;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setIsUserScrolling(distanceFromBottom > 80);

      // 상단 100px 이내 도달 시 이전 메시지 로딩
      if (el.scrollTop < 100) {
        void loadMoreMessages();
      }
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loadMoreMessages]);

  // 스트리밍 중 메시지 변경 시 자동 스크롤 (유저가 위로 올렸으면 스킵)
  useEffect(() => {
    if (!loading) return;
    if (isUserScrolling) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, isUserScrolling]);

  async function handleDeleteMessage(messageId: string) {
    const ok = window.confirm("정말 삭제하시겠습니까?");
    if (!ok) return;

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: deleteError } = await supabase.from("messages").delete().eq("id", messageId);
      if (deleteError) throw deleteError;
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      if (editId === messageId) {
        setEditId(null);
        setEditText("");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "삭제 중 오류가 발생했습니다.";
      setError(msg);
    }
  }

  function beginEdit(m: Message) {
    setEditId(m.id);
    setEditText(m.content);
    queueMicrotask(() => {
      const el = editTextareaRef.current;
      if (!el) return;
      el.style.height = "0px";
      el.style.height = `${Math.max(200, el.scrollHeight)}px`;
    });
  }

  function cancelEdit() {
    setEditId(null);
    setEditText("");
    setEditError(null);
  }

  async function saveEdit(messageId: string) {
    const text = editText.trim();
    if (!text) {
      setEditError("메시지는 비워둘 수 없습니다.");
      return;
    }
    if (savingEdit) return;

    setEditError(null);
    setSavingEdit(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase
        .from("messages")
        .update({ content: text })
        .eq("id", messageId);
      if (updateError) throw updateError;

      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, content: text } : m)));
      cancelEdit();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "수정 중 오류가 발생했습니다.";
      setEditError(msg);
      setTimeout(() => setEditError(null), 3000);
    } finally {
      setSavingEdit(false);
    }
  }

  function autosizeEditTextarea(el: HTMLTextAreaElement) {
    el.style.height = "0px";
    el.style.height = `${Math.max(200, el.scrollHeight)}px`;
  }

  async function handleStop() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    if (streamingReaderRef.current) {
      try { await streamingReaderRef.current.cancel(); } catch { /* ignore */ }
      streamingReaderRef.current = null;
    }
    setMessages((prev) => prev.filter((m) => !m.id.startsWith("temp-")));
    setLoading(false);
  }

  useEffect(() => {
    return () => { abortControllerRef.current?.abort(); };
  }, []);

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading || !characterId) return;

    setLoading(true);
    setError(null);

    const userTempId = `temp-${Date.now()}`;
    const assistantTempId = `temp-assistant-${Date.now()}`;

    // ① 유저 메시지 + ② 로딩 말풍선 추가
    const loadingTempId = `temp-loading-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: userTempId, role: "user", content: text, created_at: new Date().toISOString() },
      { id: loadingTempId, role: "loading", content: "", created_at: new Date().toISOString() },
    ]);
    setIsUserScrolling(false);
    setInput("");
    if (inputTextareaRef.current) {
      inputTextareaRef.current.style.height = "auto";
    }

    // React가 렌더링할 시간을 주고 fetch 호출
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });

    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          character_id: characterId,
          conversation_id: conversationId,
          message: text,
          model: selectedModel,
          active_persona_id: activePersonaId ?? undefined,
          user_note: userNote.trim() || undefined,
        }),
      });

      if (!res.ok || !res.body) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "메시지를 보내는 중 오류가 발생했습니다.");
        setMessages((prev) => prev.filter((m) => m.id !== userTempId && m.id !== loadingTempId));
        return;
      }

      const reader = res.body.getReader();
      streamingReaderRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = "";
      let firstChunk = true;

      function handleStreamPayload(jsonStr: string) {
        if (!jsonStr) return;

        try {
          const data = JSON.parse(jsonStr) as {
            text?: string;
            done?: boolean;
            error?: string;
            freeBalance?: number;
            paidBalance?: number;
            userMessageId?: string;
            assistantMessageId?: string;
          };
          if (data.error) {
            setError(data.error);
          }
          if (data.done && typeof data.freeBalance === "number" && typeof data.paidBalance === "number") {
            updateCredits(data.freeBalance, data.paidBalance);
          }
          if (data.done) {
            if (data.userMessageId) {
              setMessages((prev) => prev.map((msg) =>
                msg.id === userTempId ? { ...msg, id: data.userMessageId! } : msg
              ));
            }
            if (data.assistantMessageId) {
              setMessages((prev) => prev.map((msg) =>
                msg.id === assistantTempId ? { ...msg, id: data.assistantMessageId! } : msg
              ));
            }
          }
          if (!data.text) return;

          if (firstChunk) {
            firstChunk = false;
            setMessages((prev) => prev.map((m) =>
              m.id === loadingTempId
                ? {
                    id: assistantTempId,
                    role: "assistant" as const,
                    content: "",
                    created_at: new Date().toISOString(),
                    model: selectedModel,
                  }
                : m
            ));
          }

          setMessages((prev) => prev.map((m) =>
            m.id === assistantTempId
              ? { ...m, content: m.content + data.text }
              : m
          ));
        } catch {
          // ignore malformed SSE payloads
        }
      }

      function handleSseEvent(eventChunk: string) {
        for (const line of eventChunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          handleStreamPayload(line.slice(6).trim());
        }
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const eventChunk of events) {
          handleSseEvent(eventChunk);
        }
      }

      buffer += decoder.decode();
      const remainingEvents = buffer.split("\n\n").filter((chunk) => chunk.trim());
      for (const eventChunk of remainingEvents) {
        handleSseEvent(eventChunk);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "네트워크 오류가 발생했습니다.";
      setError(msg);
    } finally {
      abortControllerRef.current = null;
      streamingReaderRef.current = null;
      setMessages((prev) => prev.filter((m) => m.role !== "loading"));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen text-[#1A1A1A]" style={{ backgroundColor: fontSettings.chatBg || "#F8F8F8" }}>
      {/* 우클릭 컨텍스트 메뉴 */}
      {contextMenu && (
        <div
          style={{ position: "fixed", top: contextMenu.y, left: contextMenu.x, zIndex: 9999 }}
          onClick={(e) => e.stopPropagation()}
          className="overflow-hidden rounded-lg border border-[#E0E0E0] bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
        >
          <button
            type="button"
            onClick={() => {
              const msg = messages.find((m) => m.id === contextMenu.id);
              if (msg) beginEdit(msg);
              setContextMenu(null);
            }}
            className="w-full px-4 py-2.5 text-left text-xs text-[#333333] hover:bg-[#F8F8F8] dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            수정
          </button>
          <button
            type="button"
            onClick={() => {
              void handleDeleteMessage(contextMenu.id);
              setContextMenu(null);
            }}
            className="w-full px-4 py-2.5 text-left text-xs text-[#FF4444] hover:bg-[#FFF5F5] dark:hover:bg-zinc-700"
          >
            삭제
          </button>
        </div>
      )}
      <main className="mx-auto flex w-full max-w-4xl flex-col px-3 md:px-4">
        {/* ── 헤더 ── */}
        <div className="sticky top-14 md:top-12 z-40 mb-2 md:mb-4 flex items-center justify-between gap-2 py-2 md:py-4" style={{ backgroundColor: fontSettings.chatBg || "#F8F8F8" }}>
          {/* 좌: 뒤로가기 */}
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="flex shrink-0 min-h-[44px] items-center gap-1 text-sm font-medium text-[#666666] hover:text-[#1A1A1A]"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            <span className="hidden md:inline">대시보드로</span>
          </button>

          {/* 가운데: 캐릭터 썸네일 + 이름 */}
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
            {characterThumbnail && (
              <img
                src={characterThumbnail}
                alt={characterName ?? ""}
                className="h-7 w-7 shrink-0 rounded-full object-cover"
              />
            )}
            {characterId && characterName ? (
              <Link
                href={`/explore/${characterId}`}
                className="truncate text-sm font-semibold text-[#1A1A1A] hover:underline md:text-base"
              >
                {characterName}
              </Link>
            ) : (
              <span className="text-sm font-semibold text-[#1A1A1A] md:text-base">대화</span>
            )}
          </div>

          {/* 우: 모델 선택 + 설정 버튼 */}
          <div className="flex shrink-0 items-center gap-1.5">
            {/* 모델 드롭다운 */}
            <div className="relative" ref={modelMenuRef}>
              <button
                type="button"
                onClick={() => setModelMenuOpen((v) => !v)}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-[#E0E0E0] bg-white px-2 text-xs font-medium text-[#444444] hover:bg-[#F0F0F0]"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill={CHAT_MODELS.find((m) => m.value === selectedModel)?.heartColor ?? "#FF0000"}
                >
                  <path d="M12 21.593c-.525-.507-5.453-5.017-7.005-6.938C2.464 11.977 2 10.025 2 8.196 2 4.771 4.812 2 8.286 2c1.773 0 3.416.808 4.714 2.136C14.298 2.808 15.941 2 17.714 2 21.188 2 24 4.771 24 8.196c0 1.83-.464 3.78-2.995 6.459-1.552 1.921-6.48 6.431-7.005 6.938l-1 .948-1-.948z" />
                </svg>
                <span className="hidden sm:inline">{CHAT_MODELS.find((m) => m.value === selectedModel)?.label ?? "모델"}</span>
                <svg className="h-4 w-4 text-[#999999]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {modelMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-[#E0E0E0] bg-white py-1 shadow-lg">
                  {CHAT_MODELS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => void handleModelChange(m.value)}
                      className={`flex w-full items-center gap-2 px-3 py-2.5 text-xs hover:bg-[#F8F8F8] ${
                        selectedModel === m.value ? "font-semibold text-[#1A1A1A]" : "text-[#555555]"
                      }`}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill={m.heartColor}>
                        <path d="M12 21.593c-.525-.507-5.453-5.017-7.005-6.938C2.464 11.977 2 10.025 2 8.196 2 4.771 4.812 2 8.286 2c1.773 0 3.416.808 4.714 2.136C14.298 2.808 15.941 2 17.714 2 21.188 2 24 4.771 24 8.196c0 1.83-.464 3.78-2.995 6.459-1.552 1.921-6.48 6.431-7.005 6.938l-1 .948-1-.948z" />
                      </svg>
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 기억 버튼 */}
            <button
              type="button"
              onClick={() => setMemoryPanelOpen((v) => !v)}
              className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-[#E0E0E0] bg-white text-[#666666] hover:bg-[#F0F0F0]"
              title="장기 기억"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
              </svg>
              {memoryCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1A1A2E] px-1 text-[9px] font-bold text-white">
                  {memoryCount > 99 ? "99+" : memoryCount}
                </span>
              )}
            </button>

            {/* 설정 버튼 */}
            <button
              type="button"
              onClick={() => setSidePanelOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E0E0E0] bg-white text-[#666666] hover:bg-[#F0F0F0]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="space-y-4 pb-36 md:pb-52">
          {/* 이전 메시지 로딩 인디케이터 */}
          {isLoadingMore && (
            <p className="py-3 text-center text-[13px] text-[#999999]">
              이전 메시지 불러오는 중...
            </p>
          )}
          {!hasMore && messages.length > 0 && (
            <p className="py-3 text-center text-[12px] text-[#BBBBBB]">
              대화의 시작입니다
            </p>
          )}
          {messages.length === 0 ? (
            <p className="text-sm text-[#666666]">
              아직 메시지가 없습니다. 아래 입력창에 첫 메시지를 보내 보세요.
            </p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="flex">
                {/* wrapper: relative로 ... 버튼 기준점 */}
                <div
                  className={`group relative mt-1 ${
                    editId === m.id
                      ? "w-full"
                      : m.role === "user"
                        ? "max-w-[88%] md:max-w-[85%]"
                        : "max-w-[96%] md:max-w-[95%]"
                  } ${m.role === "user" ? "ml-auto" : "mr-auto"}`}
                  style={{ isolation: "isolate" }}
                >
                  {/* AI 말풍선 위 캐릭터 정보 */}
                  {(m.role === "assistant" || m.role === "loading") && (
                    <div className="mb-1.5 flex w-full items-center gap-2">
                      <div className="h-8 w-8 flex-shrink-0">
                        {characterThumbnail ? (
                          <img
                            src={characterThumbnail}
                            alt={characterName ?? ""}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E0E0E0] text-sm font-semibold text-[#666666]">
                            {characterName?.charAt(0) ?? "?"}
                          </div>
                        )}
                      </div>
                      {characterName && (
                        <div className="flex min-w-0 items-center gap-1">
                          <span className="truncate text-sm font-medium text-[#333333]">{characterName}</span>
                          <span className="flex-shrink-0"><ModelHeartIcon model={m.model ?? characterRecommendedModel} /></span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 말풍선 */}
                  <div
                    className={`rounded-2xl ${
                      m.role === "loading" ? "w-fit" : "min-w-0 overflow-hidden px-3 py-2"
                    } ${m.role === "user" ? "rounded-br-none" : "rounded-bl-none"}`}
                    style={{
                      backgroundColor:
                        m.role === "user" ? fontSettings.userBubbleBg : fontSettings.aiBubbleBg,
                      color:
                        m.role === "user" ? fontSettings.userFontColor : fontSettings.aiFontColor,
                      fontSize: fontSettings.fontSize,
                    }}
                    onContextMenu={(e) => {
                      if (m.role === "loading" || editId === m.id) return;
                      e.preventDefault();
                      setContextMenu({ id: m.id, x: e.clientX, y: e.clientY });
                    }}
                    onTouchStart={(e) => {
                      if (m.role === "loading" || editId === m.id) return;
                      const touch = e.touches[0];
                      const x = touch.clientX;
                      const y = touch.clientY;
                      longPressTimerRef.current = setTimeout(() => {
                        setContextMenu({ id: m.id, x, y });
                      }, 500);
                    }}
                    onTouchEnd={() => {
                      if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                      }
                    }}
                    onTouchMove={() => {
                      if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                      }
                    }}
                  >
                    {m.role === "loading" ? (
                      <TypingIndicator />
                    ) : editId === m.id ? (
                      <div className="w-full">
                        <div className="relative">
                          <textarea
                            ref={editTextareaRef}
                            value={editText}
                            onChange={(e) => {
                              setEditText(e.target.value);
                              autosizeEditTextarea(e.currentTarget);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && e.ctrlKey) {
                                e.preventDefault();
                                e.stopPropagation();
                                return;
                              }
                            }}
                            className="box-border block w-full resize-none rounded-lg border border-[#E0E0E0] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:border-[#666666]"
                            style={{ minHeight: 200, width: "100%", boxSizing: "border-box" }}
                          />
                          <p className="pointer-events-none absolute bottom-2 right-2 text-[11px] text-[#666666]">
                            {editText.length.toLocaleString()} 글자
                          </p>
                        </div>

                        <div className="mt-3 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-lg bg-[#E0E0E0] px-4 py-2 text-xs font-medium text-[#333333] hover:bg-[#D6D6D6]"
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            disabled={savingEdit}
                            onClick={() => void saveEdit(m.id)}
                            className="rounded-lg bg-[#1A1A2E] px-4 py-2 text-xs font-medium text-white hover:bg-[#141424] disabled:opacity-60"
                          >
                            {savingEdit ? "저장 중..." : "저장"}
                          </button>
                        </div>
                        {editError && (
                          <p className="mt-2 text-right text-xs text-red-500">{editError}</p>
                        )}
                      </div>
                    ) : (
                      /* 유저 / AI 공통 마크다운 렌더링 */
                      <div
                        className="chat-md min-w-0 break-words leading-7"
                      >
                        <MarkdownRenderer
                          content={replaceVariables(m.content ?? "", userName)}
                          components={m.role === "user" ? userMdComponents : aiMdComponents}
                          className="leading-relaxed"
                        />
                      </div>
                    )}
                  </div>

                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {error ? (
          <div className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 shadow">
            {error}
          </div>
        ) : null}

        <form
          onSubmit={handleSend}
          className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-2 pt-2 md:px-4 md:pb-3 md:pt-2"
          style={{ backgroundColor: fontSettings.chatBg || "#F8F8F8", paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto w-full max-w-4xl">
            {/* 통합 입력 박스 */}
            <div className="rounded-2xl border border-zinc-200 bg-white px-3 pt-3 pb-2 dark:border-zinc-700 dark:bg-zinc-800">
              <textarea
                ref={inputTextareaRef}
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = el.scrollHeight + "px";
                  el.style.overflowY = el.scrollHeight > 200 ? "auto" : "hidden";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.ctrlKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    if (input.trim() && !loading) {
                      e.currentTarget.form?.requestSubmit();
                    }
                  }
                }}
                disabled={loading}
                style={{ height: "auto", maxHeight: "200px", overflowY: "hidden" }}
                className="w-full resize-none border-0 bg-transparent text-base md:text-sm text-[#1A1A1A] outline-none placeholder:text-zinc-400 disabled:opacity-60 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                placeholder="메시지를 입력하세요..."
              />
              {/* 하단 버튼 행 */}
              <div className="mt-2 flex items-center justify-between">
                {/* 최하단 이동 버튼 — 위로 스크롤했을 때만 표시 */}
                {isUserScrolling ? (
                  <button
                    type="button"
                    onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                    aria-label="최하단으로 이동"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 dark:text-zinc-300">
                      <path d="M12 5v14M5 12l7 7 7-7" />
                    </svg>
                  </button>
                ) : (
                  <div />
                )}
                {loading ? (
                  <button
                    type="button"
                    onClick={() => void handleStop()}
                    className="flex h-9 items-center gap-1.5 rounded-full bg-red-500 px-4 text-sm font-medium text-white hover:bg-red-600"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                      <rect x="6" y="6" width="12" height="12" rx="1" />
                    </svg>
                    중지
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="flex h-9 flex-col items-center justify-center rounded-full bg-[#1A1A2E] px-5 text-white disabled:opacity-40 hover:bg-[#2a2a4e]"
                  >
                    <span className="text-xs font-semibold leading-none">전송</span>
                    <span className="text-[9px] leading-none opacity-60 mt-0.5">Ctrl+Enter</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </main>

      {/* 우측 사이드 패널 */}
      <ChatSidePanel
        open={sidePanelOpen}
        onClose={() => setSidePanelOpen(false)}
        personas={personas}
        activePersonaId={activePersonaId}
        onSelectPersona={handleSelectPersona}
        userNote={userNote}
        onUserNoteChange={handleUserNoteChange}
        fontSettings={fontSettings}
        onFontSettingsChange={handleFontSettingsChange}
        onEditPersonasClick={() => router.push("/personas")}
      />

      {/* 기억 패널 */}
      {characterId && (
        <MemoryPanel
          conversationId={conversationId}
          characterId={characterId}
          characterName={characterName ?? undefined}
          isOpen={memoryPanelOpen}
          onClose={() => {
            setMemoryPanelOpen(false);
            // 패널 닫힐 때 뱃지 카운트 갱신
            fetch(`/api/memories/${conversationId}`)
              .then((r) => r.json())
              .then((json: { memories?: unknown[] }) => setMemoryCount(json.memories?.length ?? 0))
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
}
