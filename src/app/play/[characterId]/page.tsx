import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import PlayChatClient from "./PlayChatClient";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env vars.");
  return { url, anonKey };
}

type Props = { params: Promise<{ characterId: string }> };

export default async function PlayPage({ params }: Props) {
  const { characterId } = await params;
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

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

  const { data: character } = await supabase
    .from("characters")
    .select("id, name, model, is_public")
    .eq("id", characterId)
    .maybeSingle();

  if (!character) notFound();

  return (
    <PlayChatClient
      character={{
        id: character.id as string,
        name: character.name as string,
        model: character.model as string | null,
      }}
    />
  );
}
