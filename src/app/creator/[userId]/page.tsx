import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { CreatorProfileClient } from "./CreatorProfileClient";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env vars.");
  return { url, anonKey };
}

export type CreatorCharacter = {
  id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  usage_count: number | null;
  tags: string[] | null;
};

export type CreatorProfile = {
  user_id: string;
  nickname: string;
  bio: string | null;
  avatar_url: string | null;
};

export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
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

  // 프로필 조회
  const { data: profileData } = await supabase
    .from("profiles")
    .select("user_id, nickname, bio, avatar_url")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profileData) notFound();

  // 현재 사용자
  const { data: { user } } = await supabase.auth.getUser();
  const isOwner = user?.id === userId;

  // 공개 캐릭터 조회
  const { data: charsData } = await supabase
    .from("characters")
    .select("id, name, description, thumbnail_url, usage_count, tags")
    .eq("user_id", userId)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  // 팔로워/팔로잉 수
  const [{ count: followerCount }, { count: followingCount }] = await Promise.all([
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
  ]);

  // 현재 유저가 팔로우 중인지
  let isFollowing = false;
  if (user && !isOwner) {
    const { data: followRow } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("following_id", userId)
      .maybeSingle();
    isFollowing = !!followRow;
  }

  const profile: CreatorProfile = {
    user_id: profileData.user_id as string,
    nickname: (profileData.nickname as string | null) ?? "익명",
    bio: (profileData.bio as string | null) ?? null,
    avatar_url: (profileData.avatar_url as string | null) ?? null,
  };

  const characters: CreatorCharacter[] = (charsData ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    description: (c.description as string | null) ?? null,
    thumbnail_url: (c.thumbnail_url as string | null) ?? null,
    usage_count: (c.usage_count as number | null) ?? null,
    tags: (c.tags as string[] | null) ?? null,
  }));

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <CreatorProfileClient
        profile={profile}
        characters={characters}
        isOwner={isOwner}
        currentUserId={user?.id ?? null}
        initialIsFollowing={isFollowing}
        initialFollowerCount={followerCount ?? 0}
        initialFollowingCount={followingCount ?? 0}
      />
    </div>
  );
}
