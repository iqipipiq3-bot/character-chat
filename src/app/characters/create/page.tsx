"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase";

const MODELS = [
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
  },
];

export default function CreateCharacterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(MODELS[0]?.id ?? "gemini-2.5-pro");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) {
        router.replace("/login");
        return;
      }

      const { error: insertError } = await supabase.from("characters").insert({
        user_id: user.id,
        name,
        prompt,
        model,
      });

      if (insertError) throw insertError;

      router.replace("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "캐릭터를 저장하는 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">캐릭터 만들기</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          이름과 설정 프롬프트를 입력해 AI 캐릭터를 만들어 보세요.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label className="block text-sm font-medium">캐릭터 이름</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
              placeholder="예: 친절한 판타지 마법사"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">캐릭터 설정 프롬프트</label>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              말투, 성격, 세계관, 배경 설정 등을 자연어로 자유롭게 적어 주세요.
            </p>
            <textarea
              required
              rows={6}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="mt-2 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
              placeholder="예: 너는 따뜻하고 유머러스한 마법사로, 사용자의 고민을 공감해 주며..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium">AI 모델</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900"
          >
            {loading ? "저장 중..." : "저장"}
          </button>
        </form>
      </main>
    </div>
  );
}

