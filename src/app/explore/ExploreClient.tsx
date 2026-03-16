"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabase";

type PublicCharacter = {
  id: string;
  name: string;
  prompt: string;
  model: string | null;
  user_id: string;
  usage_count: number | null;
};

export function ExploreClient({ initial }: { initial: PublicCharacter[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  async function handleStartChat(character: PublicCharacter) {
    setBusyId(character.id);
    try {
      const supabase = createSupabaseBrowserClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("로그인이 필요합니다.");

      const conversationId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${character.id}-${Date.now()}`;

      const { error: convoError } = await supabase.from("conversations").insert({
        id: conversationId,
        user_id: user.id,
        character_id: character.id,
      });
      if (convoError) throw convoError;

      // 사용 횟수 증가 (낙관적)
      const currentUsage = character.usage_count ?? 0;
      void supabase
        .from("characters")
        .update({ usage_count: currentUsage + 1 })
        .eq("id", character.id);

      router.push(`/chat/${conversationId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "대화방을 여는 중 오류가 발생했습니다.";
      setToast(msg);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="mt-6 space-y-3">
        {initial.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            아직 공개된 캐릭터가 없습니다.
          </p>
        ) : (
          initial.map((character) => (
            <article
              key={character.id}
              className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {character.name}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    작성자: {character.user_id.slice(0, 8)}…
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busyId === character.id}
                  onClick={() => void handleStartChat(character)}
                  className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {busyId === character.id ? "열는 중..." : "대화하기"}
                </button>
              </div>

              {/* 프롬프트 내용은 숨깁니다. */}

              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                사용 횟수: {character.usage_count ?? 0}
              </p>
            </article>
          ))
        )}
      </div>

      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center">
          <div className="pointer-events-auto rounded-full bg-zinc-900 px-4 py-2 text-xs font-medium text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
            {toast}
          </div>
        </div>
      ) : null}
    </>
  );
}

