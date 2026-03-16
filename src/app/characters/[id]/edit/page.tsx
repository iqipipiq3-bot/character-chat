"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase";

const MODELS = [
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
] as const;

type ModelId = (typeof MODELS)[number]["id"];

export default function EditCharacterPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ModelId>("gemini-2.5-pro");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const promptCount = useMemo(() => prompt.length, [prompt]);

  useEffect(() => {
    async function load() {
      setError(null);
      setLoading(true);

      try {
        const supabase = createSupabaseBrowserClient();
        const { data: userResult, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!userResult.user) {
          router.replace("/login");
          return;
        }

        const { data, error: fetchError } = await supabase
          .from("characters")
          .select("id, name, prompt, model")
          .eq("id", id)
          .maybeSingle();

        if (fetchError) throw fetchError;
        if (!data) throw new Error("캐릭터를 찾을 수 없습니다.");

        setName(data.name ?? "");
        setPrompt(data.prompt ?? "");
        setModel((data.model as ModelId) || "gemini-2.5-pro");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "불러오는 중 오류가 발생했습니다.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }

    if (id) void load();
  }, [id, router]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase
        .from("characters")
        .update({
          name,
          prompt,
          model,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      router.replace("/dashboard");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
        <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-6 py-12">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">불러오는 중...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">캐릭터 수정</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          이름, 프롬프트, 모델을 수정할 수 있습니다.
        </p>

        <form onSubmit={handleSave} className="mt-8 space-y-6">
          <div>
            <label className="block text-sm font-medium">캐릭터 이름</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
            />
          </div>

          <div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <label className="block text-sm font-medium">캐릭터 설정 프롬프트</label>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  최대 7000자까지 입력할 수 있습니다.
                </p>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {promptCount.toLocaleString()}/7,000
              </p>
            </div>
            <textarea
              required
              rows={10}
              maxLength={7000}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="mt-2 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">AI 모델</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as ModelId)}
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
            disabled={saving}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </form>
      </main>
    </div>
  );
}

