"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase";

type Character = {
  id: string;
  name: string;
  model: string | null;
  created_at: string;
};

export function CharacterCardsClient({ initial }: { initial: Character[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleDelete(character: Character) {
    const ok = window.confirm("정말 삭제하시겠습니까?");
    if (!ok) return;

    setBusyId(character.id);
    try {
      const supabase = createSupabaseBrowserClient();
      // 외래키 순서 문제 방지를 위해 연결 데이터부터 삭제합니다.
      const { error: messagesError } = await supabase
        .from("messages")
        .delete()
        .eq("character_id", character.id);
      if (messagesError) throw new Error(messagesError.message);

      const { error: conversationsError } = await supabase
        .from("conversations")
        .delete()
        .eq("character_id", character.id);
      if (conversationsError) throw new Error(conversationsError.message);

      const { error: characterError } = await supabase
        .from("characters")
        .delete()
        .eq("id", character.id);
      if (characterError) throw new Error(characterError.message);

      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "삭제 중 오류가 발생했습니다.";
      window.alert(message);
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
        .select("name, prompt, model")
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
      });
      if (insertError) throw insertError;

      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ul className="mt-4 space-y-3">
      {initial.map((character) => (
        <li
          key={character.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{character.name}</p>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              모델: {character.model || "Gemini 2.5 Pro"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/chat/${character.id}`}
              className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              대화 시작
            </Link>
            <Link
              href={`/characters/${character.id}/edit`}
              className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              수정
            </Link>
            <button
              type="button"
              onClick={() => void handleCopy(character)}
              disabled={busyId === character.id}
              className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              복사
            </button>
            <button
              type="button"
              onClick={() => void handleDelete(character)}
              disabled={busyId === character.id}
              className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900/60 dark:text-red-200 dark:hover:bg-red-950/30"
            >
              삭제
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

