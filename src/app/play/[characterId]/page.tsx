import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
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
  const supabase = createClient(url, anonKey);

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
