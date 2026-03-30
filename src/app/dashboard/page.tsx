import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { DashboardTabsClient } from "./DashboardTabsClient";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env vars.");
  return { url, anonKey };
}

type Character = {
  id: string;
  name: string;
  model: string | null;
  created_at: string;
  is_public: boolean | null;
  visibility: string | null;
  thumbnail_url: string | null;
  description: string | null;
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
          // Server Component에서는 set이 제한될 수 있습니다.
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: characters } = await supabase
    .from("characters")
    .select("id, name, model, created_at, is_public, visibility, thumbnail_url, description")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <DashboardTabsClient characters={(characters ?? []) as Character[]} />
  );
}
