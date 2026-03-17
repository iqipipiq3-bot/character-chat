import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { CharacterDetailClient } from "./CharacterDetailClient";
import { BottomNav } from "../../BottomNav";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env vars.");
  return { url, anonKey };
}

export type Comment = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author_nickname: string;
};

export type CharacterDetail = {
  id: string;
  name: string;
  description: string | null;
  introduction: string | null;
  thumbnail_url: string | null;
  user_id: string;
  author_nickname: string;
  usage_count: number | null;
  tags: string[] | null;
};

export default async function CharacterDetailPage({
  params,
}: {
  params: Promise<{ characterId: string }>;
}) {
  const { characterId } = await params;
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

  // 캐릭터 조회 (공개 캐릭터만)
  const { data: character } = await supabase
    .from("characters")
    .select("id, name, description, introduction, thumbnail_url, user_id, usage_count, tags")
    .eq("id", characterId)
    .eq("is_public", true)
    .maybeSingle();

  if (!character) notFound();

  // 현재 사용자
  const { data: { user } } = await supabase.auth.getUser();

  // 작성자 닉네임
  const { data: authorProfile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("user_id", character.user_id)
    .maybeSingle();

  const authorNickname = (authorProfile?.nickname as string | null) ?? "";

  // 댓글 조회
  const { data: commentsData } = await supabase
    .from("comments")
    .select("id, user_id, content, created_at, updated_at")
    .eq("character_id", characterId)
    .order("created_at", { ascending: true });

  const rawComments = commentsData ?? [];

  // 댓글 작성자 닉네임 일괄 조회
  const commentUserIds = [...new Set(rawComments.map((c) => c.user_id as string))];
  const commentAuthorMap: Record<string, string> = {};
  if (commentUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nickname")
      .in("user_id", commentUserIds);
    for (const p of profiles ?? []) {
      commentAuthorMap[p.user_id as string] = (p.nickname as string | null) ?? "";
    }
  }

  const comments: Comment[] = rawComments.map((c) => ({
    id: c.id as string,
    user_id: c.user_id as string,
    content: c.content as string,
    created_at: c.created_at as string,
    updated_at: c.updated_at as string,
    author_nickname: commentAuthorMap[c.user_id as string] ?? "",
  }));

  const characterDetail: CharacterDetail = {
    id: character.id as string,
    name: character.name as string,
    description: (character.description as string | null) ?? null,
    introduction: (character.introduction as string | null) ?? null,
    thumbnail_url: (character.thumbnail_url as string | null) ?? null,
    user_id: character.user_id as string,
    author_nickname: authorNickname,
    usage_count: (character.usage_count as number | null) ?? null,
    tags: (character.tags as string[] | null) ?? null,
  };

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <CharacterDetailClient
        character={characterDetail}
        initialComments={comments}
        currentUserId={user?.id ?? null}
        isCharacterOwner={user?.id === character.user_id}
      />
      <BottomNav />
    </div>
  );
}
