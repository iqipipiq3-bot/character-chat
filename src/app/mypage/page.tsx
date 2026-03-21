import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { MypageClient } from "./MypageClient";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env vars.");
  return { url, anonKey };
}

export type FollowedCreator = {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  character_count: number;
};

export default async function MypagePage() {
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("user_id", user.id)
    .maybeSingle();

  // 팔로우한 제작자 목록
  const { data: followsData } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id);

  const followingIds = (followsData ?? []).map((f) => f.following_id as string);

  let followedCreators: FollowedCreator[] = [];
  if (followingIds.length > 0) {
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, nickname, avatar_url")
      .in("user_id", followingIds);

    const { data: charsData } = await supabase
      .from("characters")
      .select("user_id")
      .in("user_id", followingIds)
      .eq("is_public", true);

    const charCountMap: Record<string, number> = {};
    for (const c of charsData ?? []) {
      const uid = c.user_id as string;
      charCountMap[uid] = (charCountMap[uid] ?? 0) + 1;
    }

    followedCreators = (profilesData ?? []).map((p) => ({
      user_id: p.user_id as string,
      nickname: (p.nickname as string | null) ?? "익명",
      avatar_url: (p.avatar_url as string | null) ?? null,
      character_count: charCountMap[p.user_id as string] ?? 0,
    }));
  }

  return (
    <MypageClient
      email={user.email ?? ""}
      initialNickname={(profile?.nickname as string | null) ?? ""}
      followedCreators={followedCreators}
    />
  );
}
