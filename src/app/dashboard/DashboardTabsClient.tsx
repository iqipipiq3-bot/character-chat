"use client";

import Link from "next/link";
import { CharacterCardsClient } from "./CharacterCardsClient";
import { BottomNav } from "../BottomNav";

type Character = {
  id: string;
  name: string;
  model: string | null;
  created_at: string;
  is_public: boolean | null;
  thumbnail_url: string | null;
  description: string | null;
};

type DashboardTabsClientProps = {
  characters: Character[];
};

export function DashboardTabsClient({ characters }: DashboardTabsClientProps) {
  return (
    <div className="min-h-[calc(100vh-3rem)] bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="md:pl-56">
        <div className="mx-auto w-full max-w-2xl px-6 py-10 pb-20">
          <header className="mb-8 flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">내 캐릭터 목록</h1>
            <Link
              href="/characters/create"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              캐릭터 만들기
            </Link>
          </header>

          <CharacterCardsClient initial={characters} />
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
