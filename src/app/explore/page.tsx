import { cookies } from "next/headers";
import Link from "next/link";
import { createServerClient } from "@supabase/ssr";
import { ExploreClient } from "./ExploreClient";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return { url, anonKey };
}

type PublicCharacter = {
  id: string;
  name: string;
  prompt: string;
  model: string | null;
  user_id: string;
  usage_count: number | null;
};

export default async function ExplorePage() {
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

  const { data } = await supabase
    .from("characters")
    .select("id, name, prompt, model, user_id, usage_count")
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  const list = (data ?? []) as PublicCharacter[];

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-12">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">공개 캐릭터 둘러보기</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              다른 사람들이 만든 캐릭터를 살펴보고 바로 대화해 보세요.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            내 대시보드
          </Link>
        </header>

        <ExploreClient initial={list} />
      </main>
    </div>
  );
}

