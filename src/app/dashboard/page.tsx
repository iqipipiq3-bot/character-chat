import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { DashboardTabsClient } from "./DashboardTabsClient";

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
  is_public: boolean | null;
};

type Conversation = {
  id: string;
  character_id: string;
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
    .select("persona, nickname")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: characters } = await supabase
    .from("characters")
    .select("id, name, model, created_at, is_public")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, character_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const list = (characters ?? []) as Character[];
  const convoList = (conversations ?? []) as Conversation[];
  const initialPersona = (profile?.persona as string | null) ?? "";
  const initialNickname = (profile?.nickname as string | null) ?? "";

  return (
    <DashboardTabsClient
      characters={list}
      initialPersona={initialPersona}
      conversations={convoList}
      email={user.email ?? ""}
      initialNickname={initialNickname}
    />
  );
}

