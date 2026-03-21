"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase";
import { CharacterFormClient, type CharacterFormInitialData } from "../../CharacterFormClient";

export default function EditCharacterPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<CharacterFormInitialData | null>(null);

  useEffect(() => {
    if (!id) return;

    async function load() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!user) { router.replace("/login"); return; }

        // 기본 캐릭터 정보 (반드시 있어야 함)
        const { data: char, error: charErr } = await supabase
          .from("characters")
          .select("name, description, introduction, prompt, thumbnail_url, tags")
          .eq("id", id)
          .maybeSingle();

        if (charErr) throw charErr;
        if (!char) throw new Error("캐릭터를 찾을 수 없습니다.");

        // 추가 컬럼들 (없으면 기본값 사용)
        const { data: charExtra } = await supabase
          .from("characters")
          .select("creator_comment, target_gender, age_rating, recommended_model")
          .eq("id", id)
          .maybeSingle();

        // 시나리오 (prompt 컬럼 없는 구버전 대응)
        let scenarios: { id: string; name: string; greeting: string; prompt: string }[] = [];
        const { data: scenData, error: scenErr } = await supabase
          .from("character_scenarios")
          .select("id, name, first_message, scenario_prompt")
          .eq("character_id", id);
        if (scenErr) {
          console.error("[load] scenarios fetch failed:", scenErr?.message);
        } else {
          scenarios = (scenData ?? []).map((s) => ({
            id: s.id as string,
            name: s.name as string,
            greeting: (s.first_message as string | null) ?? "",
            prompt: (s.scenario_prompt as string | null) ?? "",
          }));
        }

        // 에셋 (테이블 없으면 빈 배열)
        const { data: assets } = await supabase
          .from("character_assets")
          .select("id, url")
          .eq("character_id", id);

        // 로어북 (테이블 없으면 빈 배열)
        const { data: lorebooks } = await supabase
          .from("character_lorebooks")
          .select("id, title, keyword, content")
          .eq("character_id", id)
          .order("order", { ascending: true });

        setInitialData({
          name: (char.name as string) ?? "",
          description: (char.description as string | null) ?? "",
          introduction: (char.introduction as string | null) ?? "",
          prompt: (char.prompt as string) ?? "",
          thumbnailUrl: (char.thumbnail_url as string | null) ?? null,
          tags: (char.tags as string[] | null) ?? [],
          scenarios,
          assets: (assets ?? []) as { id: string; url: string }[],
          lorebooks: (lorebooks ?? []) as { id: string; title: string; keyword: string; content: string }[],
          creatorComment: (charExtra?.creator_comment as string | null) ?? "",
          targetGender: (charExtra?.target_gender as string | null) ?? "",
          ageRating: (charExtra?.age_rating as string | null) ?? "",
          recommendedModel: (charExtra?.recommended_model as string | null) ?? "gemini-2.5-pro",
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-sm text-zinc-500">불러오는 중...</p>
      </div>
    );
  }

  if (error || !initialData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-sm text-red-500">{error ?? "캐릭터를 찾을 수 없습니다."}</p>
      </div>
    );
  }

  return (
    <CharacterFormClient mode="edit" characterId={id} initialData={initialData} />
  );
}
