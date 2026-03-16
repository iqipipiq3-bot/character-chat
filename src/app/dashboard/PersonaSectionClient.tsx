"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase";

export function PersonaSectionClient({ initialPersona }: { initialPersona: string }) {
  const [persona, setPersona] = useState(initialPersona);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = useMemo(() => persona.length, [persona]);

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("로그인이 필요합니다.");

      const { error: upsertError } = await supabase.from("profiles").upsert(
        {
          user_id: user.id,
          persona,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (upsertError) throw upsertError;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">내 페르소나 설정</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            AI가 당신을 더 잘 이해하도록, 당신의 말투/취향/금기/상황 등을 적어둘 수 있어요.
          </p>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{count.toLocaleString()}/1,000</p>
      </div>

      <textarea
        maxLength={1000}
        rows={5}
        value={persona}
        onChange={(e) => setPersona(e.target.value)}
        className="mt-3 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
        placeholder="예: 나는 반말보다 존댓말이 좋아요. 너무 폭력적인 전개는 싫어요. ..."
      />

      {error ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </section>
  );
}

