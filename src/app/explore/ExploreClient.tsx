"use client";

import { useRouter } from "next/navigation";
import { getCardGradient } from "../lib/gradient";
import type { PublicCharacter } from "./page";

function formatCount(n: number | null): string {
  if (!n) return "";
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}천`;
  return `${n}`;
}

type Props = {
  initial: PublicCharacter[];
  query?: string;
};

export function ExploreClient({ initial, query }: Props) {
  const router = useRouter();

  if (initial.length === 0) {
    return (
      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        {query
          ? `"${query}"에 대한 검색 결과가 없습니다.`
          : "아직 공개된 캐릭터가 없습니다."}
      </p>
    );
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {initial.map((character) => (
        <button
          key={character.id}
          type="button"
          onClick={() => router.push(`/explore/${character.id}`)}
          className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white text-left transition-transform hover:scale-[1.01] active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-950"
        >
          {/* 썸네일 */}
          <div className="aspect-square w-full overflow-hidden">
            {character.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={character.thumbnail_url}
                alt={character.name}
                className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div
                className={`flex h-full w-full items-center justify-center ${getCardGradient(character.id)}`}
              >
                <span className="text-6xl font-bold text-white drop-shadow-lg">
                  {character.name.charAt(0)}
                </span>
              </div>
            )}
          </div>

          {/* 하단 정보 */}
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-semibold leading-snug">
              {character.name}
            </p>
            {character.description ? (
              <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                {character.description}
              </p>
            ) : null}

            {/* 태그 (최대 3개) */}
            {character.tags && character.tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {character.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-1.5 flex items-center justify-between gap-2">
              <p className="truncate text-xs text-zinc-400 dark:text-zinc-500">
                by{" "}
                <a
                  href={`/creator/${character.user_id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:underline hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  {character.author_nickname || "익명"}
                </a>
              </p>
              {character.usage_count ? (
                <p className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                  💬 {formatCount(character.usage_count)}
                </p>
              ) : null}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
