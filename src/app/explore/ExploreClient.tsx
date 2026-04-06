"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CharacterCard } from "../components/CharacterCard";
import type { PublicCharacter } from "./page";

type Props = {
  initial: PublicCharacter[];
  query?: string;
};

export function ExploreClient({ initial, query }: Props) {
  const router = useRouter();
  const [mobileSearch, setMobileSearch] = useState(query ?? "");

  function handleMobileSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = mobileSearch.trim();
    router.push(q ? `/explore?q=${encodeURIComponent(q)}` : "/explore");
  }

  return (
    <>
      {/* 모바일 전용 검색창 */}
      <form onSubmit={handleMobileSearchSubmit} className="mt-4 md:hidden">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="search"
            value={mobileSearch}
            onChange={(e) => setMobileSearch(e.target.value)}
            placeholder="캐릭터, 제작자, 태그 검색..."
            className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-500"
          />
        </div>
      </form>

      {initial.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          {query
            ? `"${query}"에 대한 검색 결과가 없습니다.`
            : "아직 공개된 캐릭터가 없습니다."}
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
          {initial.map((character) => (
            <CharacterCard
              key={character.id}
              character={character}
              onClick={() => router.push(`/explore/${character.id}`)}
            />
          ))}
        </div>
      )}
    </>
  );
}
