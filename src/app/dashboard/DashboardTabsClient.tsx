"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabase";
import { CharacterCardsClient } from "./CharacterCardsClient";
import { PersonaSectionClient } from "./PersonaSectionClient";

type Character = {
  id: string;
  name: string;
  model: string | null;
  created_at: string;
  is_public: boolean | null;
};

type Conversation = {
  id: string;
  character_id: string;
  created_at: string;
};

type DashboardTabsClientProps = {
  characters: Character[];
  initialPersona: string;
  conversations: Conversation[];
  email: string;
  initialNickname: string;
};

type TabId = "characters" | "chats" | "mypage";

export function DashboardTabsClient({
  characters,
  initialPersona,
  conversations,
  email,
  initialNickname,
}: DashboardTabsClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>("characters");
  const [nickname, setNickname] = useState(initialNickname);
  const [savingNickname, setSavingNickname] = useState(false);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [lastMessages, setLastMessages] = useState<
    Record<string, { content: string; created_at: string } | undefined>
  >({});

  const router = useRouter();

  const characterNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of characters) {
      map[c.id] = c.name;
    }
    return map;
  }, [characters]);

  // 채팅 탭에서 마지막 메시지 로드
  useEffect(() => {
    if (activeTab !== "chats" || conversations.length === 0) return;

    const supabase = createSupabaseBrowserClient();

    async function loadLastMessages() {
      const updates: typeof lastMessages = {};

      for (const convo of conversations) {
        const { data, error } = await supabase
          .from("messages")
          .select("content, created_at")
          .eq("conversation_id", convo.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (!error && data && data.length > 0) {
          updates[convo.id] = {
            content: data[0]?.content ?? "",
            created_at: data[0]?.created_at ?? convo.created_at,
          };
        }
      }

      setLastMessages(updates);
    }

    void loadLastMessages();
  }, [activeTab, conversations]);

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
        {
          user_id: user.id,
          nickname: nickname,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (upsertError) throw upsertError;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "닉네임 저장 중 오류가 발생했습니다.";
      setNicknameError(msg);
    } finally {
      setSavingNickname(false);
    }
  }

  const emailLocalPart = email.split("@")[0] ?? email;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">대시보드</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              캐릭터를 만들고 대화해 보세요.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/explore"
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              캐릭터 둘러보기
            </Link>
            <Link
              href="/characters/create"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              캐릭터 만들기
            </Link>
          </div>
        </header>

        {activeTab === "characters" && (
          <>
            <PersonaSectionClient initialPersona={initialPersona} />

            <section>
              <h2 className="text-lg font-semibold">내 캐릭터 목록</h2>
              {characters.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                  아직 만든 캐릭터가 없습니다. 상단의 &quot;캐릭터 만들기&quot; 버튼을 눌러
                  시작해 보세요.
                </p>
              ) : (
                <CharacterCardsClient initial={characters} />
              )}
            </section>
          </>
        )}

        {activeTab === "chats" && (
          <section className="flex-1">
            <h2 className="text-lg font-semibold">최근 대화</h2>
            {conversations.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                아직 시작한 대화가 없습니다. 캐릭터를 선택해 대화를 시작해 보세요.
              </p>
            ) : (
              <ul className="mt-4 space-y-2 text-sm">
                {conversations.map((convo) => {
                  const last = lastMessages[convo.id];
                  const date = new Date(
                    last?.created_at ?? convo.created_at
                  ).toLocaleString();
                  const preview =
                    (last?.content ?? "").slice(0, 80).replace(/\s+/g, " ") +
                    (last && last.content.length > 80 ? "…" : "");

                  return (
                    <li key={convo.id}>
                      <button
                        type="button"
                        onClick={() => router.push(`/chat/${convo.id}`)}
                        className="flex w-full items-start justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {characterNameById[convo.character_id] ?? "알 수 없는 캐릭터"}
                          </p>
                          {preview ? (
                            <p className="mt-1 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
                              {preview}
                            </p>
                          ) : null}
                        </div>
                        <p className="shrink-0 text-[11px] text-zinc-500 dark:text-zinc-400">
                          {date}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {activeTab === "mypage" && (
          <section className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">마이페이지</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                계정 정보와 닉네임을 관리합니다.
              </p>
            </div>

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
          </section>
        )}
      </main>

      <nav className="sticky bottom-0 border-t border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-black/80">
        <div className="mx-auto flex max-w-3xl items-center justify-around px-6 py-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("characters")}
            className={`flex flex-1 flex-col items-center gap-1 rounded-md px-3 py-1 ${
              activeTab === "characters"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
            <span>캐릭터 목록</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("chats")}
            className={`flex flex-1 flex-col items-center gap-1 rounded-md px-3 py-1 ${
              activeTab === "chats"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
            <span>채팅</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("mypage")}
            className={`flex flex-1 flex-col items-center gap-1 rounded-md px-3 py-1 ${
              activeTab === "mypage"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
            <span>마이페이지</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

