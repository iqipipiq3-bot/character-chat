import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { CharacterDetailClient } from "./CharacterDetailClient";

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

export type Scenario = {
  id: string;
  name: string;
  greeting: string;
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
  creator_comment: string | null;
  recommended_model: string | null;
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

  // 캐릭터 조회
  const { data: character } = await supabase
    .from("characters")
    .select("id, name, description, introduction, thumbnail_url, user_id, usage_count, tags, creator_comment, recommended_model, visibility")
    .eq("id", characterId)
    .maybeSingle();

  if (!character) notFound();

  // 현재 사용자
  const { data: { user } } = await supabase.auth.getUser();

  // visibility 접근 제어
  const visibility = (character.visibility as string | null) ?? "public";
  if (visibility === "private" && user?.id !== character.user_id) {
    return (
      <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center">
          <p className="text-4xl mb-3">🔒</p>
          <p className="text-base font-semibold text-zinc-700 dark:text-zinc-300">비공개 캐릭터입니다.</p>
          <p className="mt-1 text-sm text-zinc-500">제작자만 접근할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  // {{user}} 치환용 유저 이름
  let userName = "유저";
  if (user) {
    const { data: defaultPersona } = await supabase
      .from("personas")
      .select("name")
      .eq("user_id", user.id)
      .eq("is_default", true)
      .maybeSingle();
    if (defaultPersona?.name) {
      userName = defaultPersona.name as string;
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profile?.nickname) userName = profile.nickname as string;
    }
  }

  // 작성자 닉네임
  const { data: authorProfile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("user_id", character.user_id)
    .maybeSingle();

  const authorNickname = (authorProfile?.nickname as string | null) ?? "";

  // 시나리오 조회
  const { data: scenariosData } = await supabase
    .from("character_scenarios")
    .select("id, name, first_message")
    .eq("character_id", characterId)
    .order("created_at", { ascending: true });

  const scenarios: Scenario[] = (scenariosData ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    greeting: (s.first_message as string | null) ?? "",
  }));

  // 댓글 조회
  const { data: commentsData } = await supabase
    .from("comments")
    .select("*")
    .eq("character_id", characterId)
    .order("created_at", { ascending: true });

  const rawComments = commentsData ?? [];

  // 댓글 작성자 닉네임 별도 조회
  const commentUserIds = [...new Set(rawComments.map((c) => c.user_id as string))];
  const nicknameMap: Record<string, string> = {};
  if (commentUserIds.length > 0) {
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, nickname")
      .in("user_id", commentUserIds);
    for (const p of profilesData ?? []) {
      nicknameMap[p.user_id as string] = (p.nickname as string | null) ?? "알 수 없음";
    }
  }

  const comments: Comment[] = rawComments.map((c) => ({
    id: c.id as string,
    user_id: c.user_id as string,
    content: c.content as string,
    created_at: c.created_at as string,
    updated_at: c.updated_at as string,
    author_nickname: nicknameMap[c.user_id as string] ?? "알 수 없음",
  }));

  // 즐겨찾기 여부 확인
  let initialIsFavorited = false;
  if (user) {
    const { data: favData } = await supabase
      .from("favorites")
      .select("character_id")
      .eq("user_id", user.id)
      .eq("character_id", characterId)
      .maybeSingle();
    initialIsFavorited = !!favData;
  }

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
    creator_comment: (character.creator_comment as string | null) ?? null,
    recommended_model: (character.recommended_model as string | null) ?? null,
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] md:min-h-[calc(100vh-3rem)] bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <CharacterDetailClient
        character={characterDetail}
        scenarios={scenarios}
        initialComments={comments}
        currentUserId={user?.id ?? null}
        isCharacterOwner={user?.id === character.user_id}
        userName={userName}
        initialIsFavorited={initialIsFavorited}
      />
    </div>
  );
}
