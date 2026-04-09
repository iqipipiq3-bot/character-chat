import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { ExploreClient } from "./ExploreClient";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env vars.");
  return { url, anonKey };
}

export type PublicCharacter = {
  id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  model: string | null;
  user_id: string;
  usage_count: number | null;
  tags: string[] | null;
  author_nickname: string;
};

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // ignore
        }
      },
    },
  });

  const PAGE_SIZE = 60;

  // DB 레벨 검색 (ilike) + 페이지네이션
  let characterQuery = supabase
    .from("characters")
    .select("id, name, description, thumbnail_url, model, user_id, usage_count, tags")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (query) {
    characterQuery = characterQuery.or(
      `name.ilike.%${query}%,description.ilike.%${query}%`
    );
  }

  const { data } = await characterQuery;

  const list = (data ?? []) as Omit<PublicCharacter, "author_nickname">[];

  // 작성자 닉네임 일괄 조회
  const userIds = [...new Set(list.map((c) => c.user_id))];
  const authorMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nickname")
      .in("user_id", userIds);
    for (const p of profiles ?? []) {
      authorMap[p.user_id as string] = (p.nickname as string | null) ?? "";
    }
  }

  const enrichedList: PublicCharacter[] = list.map((c) => ({
    ...c,
    tags: (c.tags as string[] | null) ?? null,
    author_nickname: authorMap[c.user_id] ?? "",
  }));

  // 태그 + 작성자 닉네임은 DB에서 직접 검색 불가하므로 enriched 후 추가 필터
  const filtered = query
    ? enrichedList.filter((c) => {
        const q = query.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.author_nickname.toLowerCase().includes(q) ||
          (c.tags ?? []).some((t) => t.toLowerCase().includes(q))
        );
      })
    : enrichedList;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] md:h-[calc(100vh-3rem)] flex-col bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50 md:pl-56">
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 pb-24 md:px-6 md:py-10">
          <header className="mb-2">
            <h1 className="text-2xl font-semibold tracking-tight">공개 캐릭터 둘러보기</h1>
            {query ? (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                &ldquo;{query}&rdquo; 검색 결과 ({filtered.length}개)
              </p>
            ) : (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                다른 사람들이 만든 캐릭터를 살펴보고 바로 대화해 보세요.
              </p>
            )}
          </header>
          <ExploreClient initial={filtered} query={query} />
        </div>
      </main>
    </div>
  );
}
