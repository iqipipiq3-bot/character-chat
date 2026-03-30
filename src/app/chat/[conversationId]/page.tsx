"use client";

import { useEffect, useRef, useState } from "react";
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
        const parsed = JSON.parse(savedFont) as FontSettings;
        const nextFontSettings = parsed.aiBubbleBg === LEGACY_DEFAULT_AI_BUBBLE_BG
          ? { ...parsed, aiBubbleBg: DEFAULT_AI_BUBBLE_BG }
          : parsed;
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
      console.log("[chat] loadConversation start", {
        conversationId,
        characterIdFromQuery,
      });

      const { data, error } = await supabase
        .from("conversations")
        .select("character_id, model")
        .eq("id", conversationId)
        .maybeSingle();

      if (error) {
        console.error("[chat] loadConversation error", { conversationId, error });
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
            console.error("[chat] loadConversation getUser error", userError);
            setError("대화를 불러올 수 없습니다.");
            return;
          }

          // character_id는 우선 쿼리스트링에서, 없으면 URL 파라미터(conversationId)를 사용합니다.
          const newCharacterId = characterIdFromQuery ?? (conversationId as string | null);

          if (!newCharacterId) {
            console.error("[chat] loadConversation missing character_id", {
              conversationId,
              characterIdFromQuery,
            });
            setError("대화를 불러올 수 없습니다.");
            return;
          }

          // 중복 생성을 피하기 위해 upsert + onConflict 사용
          const insertPayload = {
            id: conversationId,
            user_id: user.id,
            character_id: newCharacterId,
          };
          console.log("[chat] loadConversation upserting conversation", insertPayload);

          const { error: insertError } = await supabase
            .from("conversations")
            .upsert(insertPayload, { onConflict: "id", ignoreDuplicates: true });

          if (insertError) {
            console.error("[chat] loadConversation insert error", {
              message: insertError.message,
              details: insertError.details,
            });
            setError("대화를 불러올 수 없습니다.");
            return;
          }

          console.log("[chat] loadConversation created conversation", {
            conversationId,
            character_id: newCharacterId,
          });
          setCharacterId(newCharacterId);
          return;
        } catch (err) {
          console.error("[chat] loadConversation unexpected error", err);
          setError("대화를 불러올 수 없습니다.");
          return;
        }
      }

      console.log("[chat] loadConversation success", {
        conversationId,
        character_id: data.character_id,
        model: data.model,
      });
      conversationModelRef.current = (data as { character_id: string; model?: string | null }).model ?? null;
      setCharacterId(data.character_id);
    }
    if (conversationId) void loadConversation();
  }, [conversationId, searchParams]);

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
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const streamingReaderRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const typingQueueRef = useRef<string[]>([]);
  const isTypingRef = useRef(false);

  useEffect(() => {
    async function loadMessages() {
      const supabase = createSupabaseBrowserClient();
      const { data, error: fetchError } = await supabase
        .from("messages")
        .select("id, role, content, created_at, model")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (fetchError) {
        // model 컬럼 누락 에러 무시하고 model 없이 재시도
        if (fetchError.message.includes("model")) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from("messages")
            .select("id, role, content, created_at")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: true });
          if (fallbackError) { setError(fallbackError.message); return; }
          const fallbackSorted = ((fallbackData ?? []) as Message[]).sort((a, b) => {
            const timeDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            if (timeDiff !== 0) return timeDiff;
            if (a.role === "user" && b.role === "assistant") return -1;
            if (a.role === "assistant" && b.role === "user") return 1;
            return 0;
          });
          setMessages(fallbackSorted);
          return;
        }
        setError(fetchError.message);
        return;
      }

      const sorted = ((data ?? []) as Message[]).sort((a, b) => {
        const timeDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (timeDiff !== 0) return timeDiff;
        // 같은 created_at이면 user → assistant 순서 보장
        if (a.role === "user" && b.role === "assistant") return -1;
        if (a.role === "assistant" && b.role === "user") return 1;
        return 0;
      });
      setMessages(sorted);
    }

    if (conversationId) {
      void loadMessages();
    }
  }, [conversationId]);

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
  }

  async function saveEdit(messageId: string) {
    const text = editText.trim();
    if (!text) {
      setError("메시지는 비워둘 수 없습니다.");
      return;
    }
    if (savingEdit) return;

    setSavingEdit(true);
    setError(null);
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
      setError(msg);
    } finally {
      setSavingEdit(false);
    }
  }

  function autosizeEditTextarea(el: HTMLTextAreaElement) {
    el.style.height = "0px";
    el.style.height = `${Math.max(200, el.scrollHeight)}px`;
  }

  async function handleStop() {
    typingQueueRef.current = [];
    isTypingRef.current = false;
    if (streamingReaderRef.current) {
      try { await streamingReaderRef.current.cancel(); } catch { /* ignore */ }
      streamingReaderRef.current = null;
    }
    setMessages((prev) => prev.filter((m) => !m.id.startsWith("temp-")));
    setLoading(false);
  }

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
    setInput("");

    // React가 렌더링할 시간을 주고 fetch 호출
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      // 타이핑 큐 초기화
      typingQueueRef.current = [];
      isTypingRef.current = false;

      // 글자 하나씩 타이핑 — 마지막 assistant 메시지에 추가
      async function processQueue() {
        if (isTypingRef.current) return;
        isTypingRef.current = true;
        while (typingQueueRef.current.length > 0) {
          const char = typingQueueRef.current.shift()!;
          setMessages((prev) => {
            const updated = [...prev];
            for (let i = updated.length - 1; i >= 0; i--) {
              if (updated[i].role === "assistant") {
                updated[i] = { ...updated[i], content: updated[i].content + char };
                break;
              }
            }
            return updated;
          });
          await new Promise<void>((resolve) => setTimeout(resolve, 8));
        }
        isTypingRef.current = false;
      }

      async function waitForTypingToFinish() {
        while (isTypingRef.current || typingQueueRef.current.length > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, 10));
        }
      }

      function handleStreamPayload(jsonStr: string) {
        if (!jsonStr) return;

        try {
          const data = JSON.parse(jsonStr) as {
            text?: string;
            done?: boolean;
            error?: string;
            freeBalance?: number;
            paidBalance?: number;
          };
          if (data.error) {
            setError(data.error);
          }
          if (data.done && typeof data.freeBalance === "number" && typeof data.paidBalance === "number") {
            updateCredits(data.freeBalance, data.paidBalance);
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

          typingQueueRef.current.push(...data.text.split(""));
          void processQueue();
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
          const jsonStr = "";
          continue;
          try {
            const data = JSON.parse(jsonStr) as { text?: string; done?: boolean; error?: string };
            if (data.error) {
              setError(data.error ?? null);
            }
            if (data.text) {
              if (firstChunk) {
                firstChunk = false;
                // loading 메시지 → assistant 메시지로 교체 (원자적 업데이트)
                setMessages((prev) => prev.map((m) =>
                  m.id === loadingTempId
                    ? { id: assistantTempId, role: "assistant" as const, content: "", created_at: new Date().toISOString(), model: selectedModel }
                    : m
                ));
              }
              typingQueueRef.current.push(...(data.text ?? "").split(""));
              void processQueue();
            }
          } catch { /* ignore */ }
        }
      }

      buffer += decoder.decode();
      const remainingEvents = buffer.split("\n\n").filter((chunk) => chunk.trim());
      for (const eventChunk of remainingEvents) {
        handleSseEvent(eventChunk);
      }

      await waitForTypingToFinish();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "네트워크 오류가 발생했습니다.";
      setError(msg);
    } finally {
      streamingReaderRef.current = null;
      // 혹시 남은 loading 메시지 제거
      setMessages((prev) => prev.filter((m) => m.role !== "loading"));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F8F8] text-[#1A1A1A]">
      <main className="mx-auto flex w-full max-w-7xl flex-col px-4">
        {/* ── 헤더 ── */}
        <div className="sticky top-12 z-40 mb-4 flex items-center justify-between gap-2 bg-[#F8F8F8] py-4">
          {/* 좌: 대시보드로 */}
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="shrink-0 text-sm font-medium text-[#666666] hover:text-[#1A1A1A]"
          >
            ← 대시보드로
          </button>

          {/* 가운데: 캐릭터 이름 */}
          {characterId && characterName ? (
            <Link
              href={`/explore/${characterId}`}
              className="truncate text-base font-semibold text-[#1A1A1A] hover:underline"
            >
              {characterName}
            </Link>
          ) : (
            <span className="text-base font-semibold text-[#1A1A1A]">대화</span>
          )}

          {/* 우: 모델 선택 + 설정 버튼 */}
          <div className="flex shrink-0 items-center gap-2">
            {/* 모델 드롭다운 */}
            <div className="relative" ref={modelMenuRef}>
              <button
                type="button"
                onClick={() => setModelMenuOpen((v) => !v)}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-[#E0E0E0] bg-white pl-2.5 pr-2 text-xs font-medium text-[#444444] hover:bg-[#F0F0F0]"
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill={CHAT_MODELS.find((m) => m.value === selectedModel)?.heartColor ?? "#FF0000"}
                >
                  <path d="M12 21.593c-.525-.507-5.453-5.017-7.005-6.938C2.464 11.977 2 10.025 2 8.196 2 4.771 4.812 2 8.286 2c1.773 0 3.416.808 4.714 2.136C14.298 2.808 15.941 2 17.714 2 21.188 2 24 4.771 24 8.196c0 1.83-.464 3.78-2.995 6.459-1.552 1.921-6.48 6.431-7.005 6.938l-1 .948-1-.948z" />
                </svg>
                <span>{CHAT_MODELS.find((m) => m.value === selectedModel)?.label ?? "모델 선택"}</span>
                <svg className="h-3 w-3 text-[#999999]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
                      className={`flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-[#F8F8F8] ${
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

            {/* 설정 버튼 */}
            <button
              type="button"
              onClick={() => setSidePanelOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E0E0E0] bg-white text-sm text-[#666666] hover:bg-[#F0F0F0]"
            >
              ···
            </button>
          </div>
        </div>

        <div className="space-y-4 pb-52">
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
                        ? "max-w-[85%]"
                        : "max-w-[95%]"
                  } ${m.role === "user" ? "ml-auto" : "mr-auto"} ${openMenuId === m.id ? "z-20" : "z-0"}`}
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
                      </div>
                    ) : (
                      /* 유저 / AI 공통 마크다운 렌더링 */
                      <div
                        className="chat-md min-w-0 break-words leading-7"
                      >
                        <MarkdownRenderer
                          content={replaceVariables(m.content ?? "", userName).replaceAll("\n", "\n\n")}
                          components={m.role === "user" ? userMdComponents : aiMdComponents}
                          className="leading-relaxed"
                        />
                      </div>
                    )}
                  </div>

                  {/* ... 버튼: 유저=우측 하단, AI=좌측 하단 (loading 제외) */}
                  {editId !== m.id && m.role !== "loading" && (
                    <div className={`absolute bottom-0 z-20 translate-y-full pt-1 opacity-0 transition-opacity group-hover:opacity-100 ${m.role === "user" ? "right-0" : "left-0"}`}>
                      <button
                        type="button"
                        onClick={() => setOpenMenuId(openMenuId === m.id ? null : m.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-[#D0D0D0] bg-white text-xs text-[#666666] shadow-sm hover:bg-[#F0F0F0]"
                      >
                        ···
                      </button>
                      {openMenuId === m.id && (
                        <div className={`absolute z-10 mt-1 w-20 overflow-hidden rounded-lg border border-[#E0E0E0] bg-white shadow-md ${m.role === "user" ? "right-0" : "left-0"}`}>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              beginEdit(m);
                            }}
                            className="w-full px-3 py-2 text-left text-xs text-[#333333] hover:bg-[#F8F8F8]"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              void handleDeleteMessage(m.id);
                            }}
                            className="w-full px-3 py-2 text-left text-xs text-[#FF4444] hover:bg-[#FFF5F5]"
                          >
                            삭제
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {error ? (
          <div className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 shadow">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSend} className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#E8E8E8] bg-[#F8F8F8] px-4 py-3">
          <div className="mx-auto flex w-full max-w-7xl gap-2">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 resize-none rounded-lg border border-[#E0E0E0] bg-white px-3 py-2 text-sm outline-none focus:border-[#666666] disabled:opacity-60"
            placeholder="메시지를 입력하세요..."
          />
          {loading ? (
            <button
              type="button"
              onClick={() => void handleStop()}
              className="h-[42px] self-end rounded-lg bg-red-500 px-4 text-sm font-medium text-white hover:bg-red-600"
            >
              중지
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="h-[42px] self-end rounded-lg bg-[#1A1A2E] px-4 text-sm font-medium text-white disabled:opacity-60"
            >
              전송
            </button>
          )}
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
    </div>
  );
}
