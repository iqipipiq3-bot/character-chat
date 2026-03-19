"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "../../lib/supabase";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import React from "react";
import {
  ChatSidePanel,
  DEFAULT_FONT_SETTINGS,
  type FontSettings,
  type Persona,
} from "./ChatSidePanel";

type Message = {
  id: string;
  role: "user" | "assistant";
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

const ALLOWED_MODELS = ["gemini-2.5-pro", "gemini-3.1-pro-preview"] as const;
type ModelId = (typeof ALLOWED_MODELS)[number];

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
            padding: "5px 14px",
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
      <pre style={{ margin: 0, padding: "6px 14px", lineHeight: 1.1 }}>
        <code
          style={{
            color: textColor,
            fontFamily: "inherit",
            fontSize: "0.85rem",
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

  // 사이드 패널
  const [sidePanelOpen, setSidePanelOpen] = useState(false);

  // 모델 선택
  const [selectedModel, setSelectedModel] = useState<ModelId>("gemini-2.5-pro");

  // 페르소나
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);

  // 유저 노트
  const [userNote, setUserNote] = useState("");

  // 글꼴 설정
  const [fontSettings, setFontSettings] = useState<FontSettings>(DEFAULT_FONT_SETTINGS);

  // localStorage 초기화 + 헤더 모델 변경 이벤트 수신
  useEffect(() => {
    const savedModel = localStorage.getItem("chat_model");
    if (savedModel && ALLOWED_MODELS.includes(savedModel as ModelId)) {
      setSelectedModel(savedModel as ModelId);
    }

    function onModelChange(e: Event) {
      const model = (e as CustomEvent<{ model: string }>).detail.model;
      if (ALLOWED_MODELS.includes(model as ModelId)) {
        setSelectedModel(model as ModelId);
      }
    }
    const savedPersonaId = localStorage.getItem("chat_active_persona_id");
    setActivePersonaId(savedPersonaId ?? null);
    setUserNote(localStorage.getItem("chat_user_note") ?? "");
    const savedFont = localStorage.getItem("chat_font_settings");
    if (savedFont) {
      try { setFontSettings(JSON.parse(savedFont) as FontSettings); } catch { /* ignore */ }
    }

    window.addEventListener("chatModelChange", onModelChange);
    return () => window.removeEventListener("chatModelChange", onModelChange);
  }, []);

  // 모델 변경 핸들러
  function handleModelChange(model: ModelId) {
    setSelectedModel(model);
    localStorage.setItem("chat_model", model);
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
    localStorage.setItem("chat_user_note", note);
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
        .select("character_id")
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
      });
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
        supabase.from("characters").select("name, thumbnail_url").eq("id", characterId!).maybeSingle(),
        supabase.auth.getUser(),
      ]);
      setCharacterName((char?.name as string | null) ?? null);
      setCharacterThumbnail((char?.thumbnail_url as string | null) ?? null);
      if (!user) return;
      const { data: personaData } = await supabase
        .from("personas")
        .select("id, name, content, is_default")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      setPersonas((personaData ?? []) as Persona[]);
    }
    void loadCharacterAndPersonas();
  }, [characterId]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);

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
          setMessages((fallbackData ?? []) as Message[]);
          return;
        }
        setError(fetchError.message);
        return;
      }

      setMessages((data ?? []) as Message[]);
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

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading || !characterId) return;

    setLoading(true);
    setError(null);

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    try {
      const requestBody = {
        character_id: characterId,
        conversation_id: conversationId,
        message: text,
        model: selectedModel,
        active_persona_id: activePersonaId ?? undefined,
        user_note: userNote.trim() || undefined,
      };
      console.log("[chat] request body", requestBody);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      console.log("[chat] response", data);

      if (!res.ok || !data.reply) {
        const msg = data.error ?? "메시지를 보내는 중 오류가 발생했습니다.";
        setError(msg);
        return;
      }

      const assistantMessage: Message = {
        id: `temp-assistant-${Date.now()}`,
        role: "assistant",
        content: data.reply,
        created_at: new Date().toISOString(),
        model: selectedModel,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "네트워크 오류가 발생했습니다.";
      setError(msg);
    } finally {
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

          {/* 우: 설정 버튼 */}
          <button
            type="button"
            onClick={() => setSidePanelOpen((v) => !v)}
            className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-[#E0E0E0] bg-white text-sm text-[#666666] hover:bg-[#F0F0F0]"
          >
            ···
          </button>
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
                  {m.role === "assistant" && (
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
                          <span className="flex-shrink-0"><ModelHeartIcon model={m.model ?? "gemini-2.5-pro"} /></span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 말풍선 */}
                  <div
                    className={`min-w-0 overflow-hidden rounded-2xl px-3 py-2 ${
                      m.role === "user" ? "rounded-br-none" : "rounded-bl-none"
                    }`}
                    style={{
                      backgroundColor:
                        m.role === "user" ? fontSettings.userBubbleBg : fontSettings.aiBubbleBg,
                      color:
                        m.role === "user" ? fontSettings.userFontColor : fontSettings.aiFontColor,
                      fontSize: fontSettings.fontSize,
                    }}
                  >
                    {editId === m.id ? (
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
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={m.role === "user" ? userMdComponents : aiMdComponents}
                        >
                          {(m.content ?? "").replaceAll("\n", "\n\n")}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>

                  {/* ... 버튼: 유저=우측 하단, AI=좌측 하단 */}
                  {editId !== m.id && (
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
            className="flex-1 resize-none rounded-lg border border-[#E0E0E0] bg-white px-3 py-2 text-sm outline-none focus:border-[#666666]"
            placeholder="메시지를 입력하세요..."
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="h-[42px] self-end rounded-lg bg-[#1A1A2E] px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? "전송 중..." : "전송"}
          </button>
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

