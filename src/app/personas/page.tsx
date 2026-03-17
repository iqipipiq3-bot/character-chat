import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { PersonasClient } from "./PersonasClient";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env vars.");
  return { url, anonKey };
}

type Persona = {
  id: string;
  name: string;
  content: string;
  is_default: boolean;
  created_at: string;
};

export default async function PersonasPage() {
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

  const { data: personas } = await supabase
    .from("personas")
    .select("id, name, content, is_default, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return (
    <PersonasClient
      initial={(personas ?? []) as Persona[]}
      userId={user.id}
    />
  );
}
