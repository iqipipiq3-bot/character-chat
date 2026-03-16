import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { CharacterCardsClient } from "./CharacterCardsClient";
import { PersonaSectionClient } from "./PersonaSectionClient";

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

type Character = {
  id: string;
  name: string;
  model: string | null;
  created_at: string;
};

export default async function DashboardPage() {
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
          // Server Component에서는 set이 제한될 수 있어요.
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("persona")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: characters } = await supabase
    .from("characters")
    .select("id, name, model, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const list = (characters ?? []) as Character[];
  const initialPersona = (profile?.persona as string | null) ?? "";

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-10 px-6 py-12">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">대시보드</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              캐릭터를 만들고 대화해 보세요.
            </p>
          </div>
          <Link
            href="/characters/create"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            캐릭터 만들기
          </Link>
        </header>

        <PersonaSectionClient initialPersona={initialPersona} />

        <section>
          <h2 className="text-lg font-semibold">내 캐릭터 목록</h2>
          {list.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              아직 만든 캐릭터가 없습니다. 상단의 &quot;캐릭터 만들기&quot; 버튼을 눌러 시작해 보세요.
            </p>
          ) : (
            <CharacterCardsClient initial={list} />
          )}
        </section>
      </main>
    </div>
  );
}

