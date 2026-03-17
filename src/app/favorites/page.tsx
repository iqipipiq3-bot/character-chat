import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { FavoritesClient } from "./FavoritesClient";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env vars.");
  return { url, anonKey };
}

type FavoriteCharacter = {
  id: string;
  name: string;
  model: string | null;
  is_public: boolean | null;
};

export default async function FavoritesPage() {
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

  const { data: favorites } = await supabase
    .from("favorites")
    .select("character_id")
    .eq("user_id", user.id);

  const characterIds = (favorites ?? []).map((f) => f.character_id as string);

  let characters: FavoriteCharacter[] = [];
  if (characterIds.length > 0) {
    const { data } = await supabase
      .from("characters")
      .select("id, name, model, is_public")
      .in("id", characterIds);
    characters = (data ?? []) as FavoriteCharacter[];
  }

  return <FavoritesClient initial={characters} />;
}
