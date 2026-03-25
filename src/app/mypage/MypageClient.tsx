"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabase";
import { getCardGradient } from "../lib/gradient";
import type { FollowedCreator } from "./page";

type Props = {
  email: string;
  initialNickname: string;
  followedCreators: FollowedCreator[];
};

export function MypageClient({ email, initialNickname, followedCreators }: Props) {
  const router = useRouter();
  const [nickname, setNickname] = useState(initialNickname);
  const [savingNickname, setSavingNickname] = useState(false);
  const [nicknameError, setNicknameError] = useState<string | null>(null);

  const emailLocalPart = email.split("@")[0] ?? email;

  async function saveNickname() {
    if (savingNickname) return;
    setSavingNickname(true);
    setNicknameError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("로그인이 필요합니다.");
      const { error: upsertError } = await supabase.from("profiles").upsert(
        { user_id: user.id, nickname, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      if (upsertError) throw upsertError;
    } catch (err) {
      setNicknameError(err instanceof Error ? err.message : "닉네임 저장 중 오류가 발생했습니다.");
    } finally {
      setSavingNickname(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-6 py-10 pb-20">
          <header className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight">마이페이지</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              계정 정보와 닉네임을 관리합니다.
            </p>
          </header>

          <div className="space-y-4">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">이메일</p>
              <p className="mt-1 text-sm">{email}</p>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                닉네임
              </label>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                닉네임이 없으면 기본으로 이메일 이름 부분({emailLocalPart})이 사용됩니다.
              </p>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
              />
              {nicknameError ? (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">{nicknameError}</p>
              ) : null}
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={savingNickname}
                  onClick={() => void saveNickname()}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {savingNickname ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>

            <Link
              href="/favorites"
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
            >
              <span>⭐ 즐겨찾기 목록 보기</span>
              <span className="text-zinc-400">→</span>
            </Link>

            <Link
              href="/personas"
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
            >
              <span>👤 페르소나 관리</span>
              <span className="text-zinc-400">→</span>
            </Link>
          </div>

          {/* 팔로우한 크리에이터 */}
          <div className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">팔로우한 크리에이터</h2>
            {followedCreators.length === 0 ? (
              <p className="rounded-lg border border-zinc-200 bg-white px-4 py-4 text-sm text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950">
                아직 팔로우한 크리에이터가 없습니다.
              </p>
            ) : (
              <div className="space-y-2">
                {followedCreators.map((creator) => (
                  <button
                    key={creator.user_id}
                    type="button"
                    onClick={() => router.push(`/creator/${creator.user_id}`)}
                    className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full ${getCardGradient(creator.user_id)}`}>
                      {creator.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={creator.avatar_url} alt={creator.nickname} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-white">{creator.nickname.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{creator.nickname}</p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">캐릭터 {creator.character_count}개</p>
                    </div>
                    <span className="shrink-0 text-zinc-400">→</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
