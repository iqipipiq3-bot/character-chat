"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase";
import { getCardGradient } from "../../lib/gradient";

export type FollowedCreator = {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  character_count: number;
};

type Props = {
  initialCreators: FollowedCreator[];
};

export function FollowingClient({ initialCreators }: Props) {
  const router = useRouter();
  const [creators, setCreators] = useState<FollowedCreator[]>(initialCreators);
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null);

  async function handleUnfollow(targetUserId: string) {
    if (unfollowingId) return;
    setUnfollowingId(targetUserId);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId);
      setCreators((prev) => prev.filter((c) => c.user_id !== targetUserId));
    } finally {
      setUnfollowingId(null);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col bg-zinc-50 dark:bg-black">
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        {/* 헤더 */}
        <div className="mb-8 flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push("/mypage")}
            className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← 마이페이지
          </button>
          <h1 className="text-2xl font-semibold tracking-tight">팔로우한 크리에이터</h1>
        </div>

        {/* 목록 */}
        {creators.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white py-16 text-center dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-sm font-medium text-zinc-500">아직 팔로우한 크리에이터가 없습니다.</p>
            <Link
              href="/explore"
              className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              크리에이터 둘러보기
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {creators.map((creator) => (
              <div
                key={creator.user_id}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
              >
                {/* 아바타 */}
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full ${getCardGradient(creator.user_id)}`}
                >
                  {creator.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={creator.avatar_url}
                      alt={creator.nickname}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-bold text-white">
                      {creator.nickname.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* 닉네임 + 캐릭터 수 */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {creator.nickname}
                  </p>
                  <p className="text-xs text-zinc-400">캐릭터 {creator.character_count}개</p>
                </div>

                {/* 제작자 페이지 이동 */}
                <Link
                  href={`/creator/${creator.user_id}`}
                  className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
                >
                  페이지
                </Link>

                {/* 언팔로우 버튼 */}
                <button
                  type="button"
                  disabled={unfollowingId === creator.user_id}
                  onClick={() => void handleUnfollow(creator.user_id)}
                  className="shrink-0 rounded-lg border border-red-100 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/30 dark:hover:bg-red-950/20"
                >
                  {unfollowingId === creator.user_id ? "처리 중..." : "언팔로우"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
