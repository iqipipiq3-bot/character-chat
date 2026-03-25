"use client";

import { useRouter } from "next/navigation";
import { CharacterCard } from "../components/CharacterCard";
import type { PublicCharacter } from "./page";

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
        <CharacterCard
          key={character.id}
          character={character}
          onClick={() => router.push(`/explore/${character.id}`)}
        />
      ))}
    </div>
  );
}
