"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabase";

type FavoriteCharacter = {
  id: string;
  name: string;
  model: string | null;
  is_public: boolean | null;
};

export function FavoritesClient({ initial }: { initial: FavoriteCharacter[] }) {
  const router = useRouter();
  const [characters, setCharacters] = useState<FavoriteCharacter[]>(initial);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleRemoveFavorite(characterId: string) {
    setRemovingId(characterId);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("로그인이 필요합니다.");

      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("character_id", characterId);
      if (error) throw error;

      setCharacters((prev) => prev.filter((c) => c.id !== characterId));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "즐겨찾기 해제 중 오류가 발생했습니다.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← 마이페이지로
          </button>
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">즐겨찾기</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            즐겨찾기한 캐릭터 목록입니다.
          </p>
        </div>

        {characters.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white px-6 py-10 text-center dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              즐겨찾기한 캐릭터가 없습니다.
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              캐릭터 목록으로
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {characters.map((character) => (
              <li
                key={character.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">⭐ {character.name}</p>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    모델: {character.model || "Gemini 2.5 Pro"}
                    {character.is_public ? (
                      <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-100">
                        공개중
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/chat/${character.id}`}
                    className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    대화 시작
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleRemoveFavorite(character.id)}
                    disabled={removingId === character.id}
                    className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900/60 dark:text-red-200 dark:hover:bg-red-950/30"
                  >
                    {removingId === character.id ? "해제 중..." : "즐겨찾기 해제"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
