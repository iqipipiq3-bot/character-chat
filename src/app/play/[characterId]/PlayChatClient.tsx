"use client";

import { useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Character = {
  id: string;
  name: string;
  model: string | null;
};

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function PlayChatClient({ character }: { character: Character }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: Message = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character_id: character.id,
          messages,
          message: text,
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };

      if (!res.ok || !data.reply) {
        setError(data.error ?? "메시지를 보내는 중 오류가 발생했습니다.");
        return;
      }

      setMessages([...newMessages, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F8F8] text-[#1A1A1A]">
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href="/explore"
            className="text-sm font-medium text-[#666666] hover:text-[#1A1A1A]"
          >
            ← 둘러보기
          </Link>
          <h1 className="text-lg font-semibold">{character.name}</h1>
          <Link
            href="/login"
            className="rounded-lg border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
          >
            로그인
          </Link>
        </div>

        <div
          className="flex-1 space-y-4 overflow-y-auto rounded-lg border border-[#E0E0E0] bg-white p-4"
          style={{ minHeight: 400 }}
        >
          {messages.length === 0 ? (
            <p className="text-sm text-[#666666]">
              아직 메시지가 없습니다. 아래 입력창에 첫 메시지를 보내 보세요.
            </p>
          ) : (
            messages.map((m, i) => (
              <div key={i} className="flex">
                <div
                  className={`mt-1 max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "ml-auto rounded-br-none bg-[#FFE0DB] text-[#1A1A1A]"
                      : "mr-auto rounded-bl-none border border-[#E0E0E0] bg-white text-[#1A1A1A]"
                  }`}
                >
                  <div className="chat-md text-sm leading-7 text-[#1A1A1A]">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        em: ({ children }) => (
                          <em style={{ color: "#888888", fontStyle: "italic" }}>{children}</em>
                        ),
                        p: ({ children }) => <p className="my-3">{children}</p>,
                      }}
                    >
                      {m.content.replaceAll("\n", "\n\n")}
                    </ReactMarkdown>
                  </div>
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

        <p className="mt-3 text-center text-xs text-[#999999]">
          로그인 없이 대화 중입니다. 대화 내용은 저장되지 않습니다.
        </p>
      </main>
    </div>
  );
}
