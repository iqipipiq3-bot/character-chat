import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env vars.");
  return { url, anonKey };
}

type Conversation = {
  id: string;
  character_id: string;
  created_at: string;
  title: string | null;
  character_name: string;
  character_thumbnail: string | null;
};

export default async function ChatsPage() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch { /* ignore */ }
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: convos } = await supabase
    .from("conversations")
    .select("id, character_id, created_at, title")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const list = (convos ?? []) as { id: string; character_id: string; created_at: string; title: string | null }[];

  // 캐릭터 이름/썸네일 일괄 조회
  const charIds = [...new Set(list.map((c) => c.character_id))];
  const charMap: Record<string, { name: string; thumbnail_url: string | null }> = {};
  if (charIds.length > 0) {
    const { data: chars } = await supabase
      .from("characters")
      .select("id, name, thumbnail_url")
      .in("id", charIds);
    for (const c of chars ?? []) {
      charMap[c.id as string] = {
        name: (c.name as string) ?? "알 수 없는 캐릭터",
        thumbnail_url: (c.thumbnail_url as string | null) ?? null,
      };
    }
  }

  const conversations: Conversation[] = list.map((c) => ({
    ...c,
    character_name: charMap[c.character_id]?.name ?? "알 수 없는 캐릭터",
    character_thumbnail: charMap[c.character_id]?.thumbnail_url ?? null,
  }));

  function formatDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    }
    if (diffDays < 7) return `${diffDays}일 전`;
    return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-2xl">
        <div className="px-4 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <h1 className="text-lg font-semibold">채팅방</h1>
          <p className="text-xs text-zinc-500 mt-0.5">최근 대화 목록</p>
        </div>

        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <svg className="h-12 w-12 text-zinc-200 dark:text-zinc-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
            </svg>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">아직 채팅방이 없어요</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">캐릭터를 찾아서 대화를 시작해 보세요!</p>
            <Link
              href="/explore"
              className="mt-4 rounded-full bg-zinc-900 px-4 py-2 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              캐릭터 둘러보기
            </Link>
          </div>
        ) : (
          <ul>
            {conversations.map((convo) => (
              <li key={convo.id}>
                <Link
                  href={`/chat/${convo.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 active:bg-zinc-100 dark:active:bg-zinc-800 transition-colors border-b border-zinc-50 dark:border-zinc-900"
                >
                  {/* 캐릭터 썸네일 */}
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                    {convo.character_thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={convo.character_thumbnail}
                        alt={convo.character_name}
                        className="h-full w-full object-cover object-top"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-bold text-zinc-400 dark:text-zinc-500">
                        {convo.character_name.charAt(0)}
                      </div>
                    )}
                  </div>

                  {/* 텍스트 */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {convo.character_name}
                    </p>
                    {convo.title && (
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {convo.title}
                      </p>
                    )}
                  </div>

                  {/* 날짜 */}
                  <span className="shrink-0 text-[10px] text-zinc-400 dark:text-zinc-500">
                    {formatDate(convo.created_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* 하단 탭바 공간 확보 */}
        <div className="h-20 md:hidden" />
      </div>
    </div>
  );
}
