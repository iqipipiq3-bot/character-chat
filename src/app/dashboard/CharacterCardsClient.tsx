"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabase";
import { getCardGradient } from "../lib/gradient";

type Character = {
  id: string;
  name: string;
  model: string | null;
  created_at: string;
  is_public: boolean | null;
  thumbnail_url: string | null;
  description: string | null;
};

type Props = {
  initial: Character[];
};

export function CharacterCardsClient({ initial }: Props) {
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!openMenuId) return;
    function handle() {
      setOpenMenuId(null);
    }
    document.addEventListener("click", handle);
    return () => document.removeEventListener("click", handle);
  }, [openMenuId]);

  async function handleTogglePublic(character: Character) {
    setBusyId(character.id);
    try {
      const supabase = createSupabaseBrowserClient();
      const target = !character.is_public;
      const { error } = await supabase
        .from("characters")
        .update({ is_public: target })
        .eq("id", character.id);
      if (error) throw new Error(error.message);
      setCharacters((prev) =>
        prev.map((c) => (c.id === character.id ? { ...c, is_public: target } : c))
      );
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "공개 설정 변경 중 오류가 발생했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(character: Character) {
    const ok = window.confirm("정말 삭제하시겠습니까?");
    if (!ok) return;
    setBusyId(character.id);
    try {
      const supabase = createSupabaseBrowserClient();

      // ① messages 삭제 (character_id 기준)
      const { error: msgErr } = await supabase
        .from("messages")
        .delete()
        .eq("character_id", character.id);
      if (msgErr) throw new Error(msgErr.message);

      // ② conversations 삭제
      const { error: convoErr } = await supabase
        .from("conversations")
        .delete()
        .eq("character_id", character.id);
      if (convoErr) throw new Error(convoErr.message);

      // ③ favorites 삭제
      const { error: favErr } = await supabase
        .from("favorites")
        .delete()
        .eq("character_id", character.id);
      if (favErr) throw new Error(favErr.message);

      // ④ characters 삭제
      const { error: charErr } = await supabase
        .from("characters")
        .delete()
        .eq("id", character.id);
      if (charErr) throw new Error(charErr.message);

      setCharacters((prev) => prev.filter((c) => c.id !== character.id));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "삭제 중 오류가 발생했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCopy(character: Character) {
    setBusyId(character.id);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: original, error: originalError } = await supabase
        .from("characters")
        .select("name, prompt, model, description")
        .eq("id", character.id)
        .maybeSingle();
      if (originalError) throw originalError;
      if (!original) throw new Error("캐릭터를 찾을 수 없습니다.");
      const { data: userResult, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userResult.user) throw new Error("로그인이 필요합니다.");
      const { error: insertError } = await supabase.from("characters").insert({
        user_id: userResult.user.id,
        name: `[복사] ${original.name}`,
        prompt: original.prompt,
        model: original.model,
        description: original.description,
      });
      if (insertError) throw insertError;
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "복사 중 오류가 발생했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCopyLink(character: Character) {
    const url = `${window.location.origin}/play/${character.id}`;
    try {
      await navigator.clipboard.writeText(url);
      window.alert("링크가 복사되었습니다.");
    } catch {
      window.prompt("아래 링크를 복사하세요:", url);
    }
  }

  if (characters.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        아직 만든 캐릭터가 없습니다. 상단의 &quot;캐릭터 만들기&quot; 버튼을 눌러 시작해 보세요.
      </p>
    );
  }

  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {characters.map((character) => (
        <div
          key={character.id}
          /* relative이되 overflow-hidden 없음 → 드롭다운이 카드 위로 자유롭게 올라올 수 있음 */
          className="relative rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
        >
          {/* 카드 클릭 → 대화 시작 */}
          <button
            type="button"
            onClick={() => router.push(`/chat/${character.id}`)}
            className="block w-full text-left hover:opacity-90 active:opacity-75"
          >
            {/* 1:1 썸네일 */}
            <div className="relative aspect-square w-full overflow-hidden rounded-t-xl">
              {character.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={character.thumbnail_url}
                  alt={character.name}
                  className="h-full w-full object-cover object-top"
                />
              ) : (
                <div className={`flex h-full w-full items-center justify-center ${getCardGradient(character.id)}`}>
                  <span className="text-3xl font-bold text-white drop-shadow">
                    {character.name.charAt(0)}
                  </span>
                </div>
              )}
              {/* 공개/비공개 뱃지 */}
              {character.is_public ? (
                <span className="absolute left-2 top-2 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                  공개
                </span>
              ) : (
                <span className="absolute left-2 top-2 rounded-full bg-zinc-600/80 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                  비공개
                </span>
              )}
            </div>
            {/* 하단 정보 영역 — pb-8 으로 ··· 버튼 공간 확보 */}
            <div className="px-3 pb-8 pt-2">
              <p className="truncate text-sm font-semibold leading-snug">{character.name}</p>
              <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                {character.description ?? ""}
              </p>
            </div>
          </button>

          {/* ··· 버튼 — 카드 하단 우측 고정 */}
          <div className="absolute bottom-2 right-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenuId(openMenuId === character.id ? null : character.id);
              }}
              disabled={busyId === character.id}
              className="flex h-6 w-6 items-center justify-center rounded text-sm text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              ···
            </button>

            {/* 드롭다운 — 버튼 위쪽으로 열림 */}
            {openMenuId === character.id ? (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-full right-0 z-50 mb-1 w-36 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
              >
                <button
                  type="button"
                  onClick={() => { setOpenMenuId(null); void handleCopyLink(character); }}
                  className="flex w-full items-center px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  링크 복사
                </button>
                <button
                  type="button"
                  disabled={busyId === character.id}
                  onClick={() => { setOpenMenuId(null); void handleTogglePublic(character); }}
                  className="flex w-full items-center px-3 py-2 text-xs hover:bg-zinc-50 disabled:opacity-60 dark:hover:bg-zinc-800"
                >
                  {character.is_public ? "비공개로 전환" : "공개로 전환"}
                </button>
                <button
                  type="button"
                  onClick={() => { setOpenMenuId(null); router.push(`/characters/${character.id}/edit`); }}
                  className="flex w-full items-center px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  수정
                </button>
                <button
                  type="button"
                  disabled={busyId === character.id}
                  onClick={() => { setOpenMenuId(null); void handleCopy(character); }}
                  className="flex w-full items-center px-3 py-2 text-xs hover:bg-zinc-50 disabled:opacity-60 dark:hover:bg-zinc-800"
                >
                  복사
                </button>
                <button
                  type="button"
                  disabled={busyId === character.id}
                  onClick={() => { setOpenMenuId(null); void handleDelete(character); }}
                  className="flex w-full items-center px-3 py-2 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  삭제
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
