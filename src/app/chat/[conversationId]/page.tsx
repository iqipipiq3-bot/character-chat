"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export default function ChatPage() {
  const router = useRouter();
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;
  const searchParams = useSearchParams();
  // 여기서는 character_id와 conversation_id를 동일하게 사용합니다.
  const [characterId, setCharacterId] = useState<string | null>(null);

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

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    async function loadMessages() {
      const supabase = createSupabaseBrowserClient();
      const { data, error: fetchError } = await supabase
        .from("messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (fetchError) {
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
    <div className="flex min-h-screen flex-col bg-[#F8F8F8] text-[#1A1A1A]">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="text-sm font-medium text-[#666666] hover:text-[#1A1A1A]"
          >
            ← 대시보드로
          </button>
          <h1 className="text-lg font-semibold">대화</h1>
          <div className="w-[92px]" />
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto rounded-lg border border-[#E0E0E0] bg-white p-4">
          {messages.length === 0 ? (
            <p className="text-sm text-[#666666]">
              아직 메시지가 없습니다. 아래 입력창에 첫 메시지를 보내 보세요.
            </p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="flex">
                <div
                  className={`group relative mt-1 ${editId === m.id ? "w-full" : "max-w-[80%]"} rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "ml-auto rounded-br-none bg-[#FFE0DB] text-[#1A1A1A]"
                      : "mr-auto rounded-bl-none border border-[#E0E0E0] bg-white text-[#1A1A1A]"
                  }`}
                >
                  {editId !== m.id ? (
                    <div className="absolute bottom-2 right-2 flex items-center gap-2 opacity-30 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => beginEdit(m)}
                        className="rounded-full border border-[#666666] bg-white px-2 py-1 text-xs font-medium text-[#666666] hover:bg-[#F8F8F8]"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteMessage(m.id)}
                        className="rounded-full border border-[#FF4444] bg-white px-2 py-1 text-xs font-medium text-[#FF4444] hover:bg-[#FFF5F5]"
                      >
                        삭제
                      </button>
                    </div>
                  ) : null}

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
                    <div className="chat-md pr-14 text-sm leading-7 text-[#1A1A1A]">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          em: ({ children }) => (
                            <em style={{ color: "#888888", fontStyle: "italic" }}>{children}</em>
                          ),
                          p: ({ children }) => <p className="my-3">{children}</p>,
                        }}
                      >
                        {(m.content ?? "").replaceAll("\n", "\n\n")}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {error ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSend} className="mt-4 flex gap-2">
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
        </form>
      </main>
    </div>
  );
}

