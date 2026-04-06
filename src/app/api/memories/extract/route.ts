import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env vars.");
  return { url, anonKey };
}

function getGeminiApiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set.");
  return key;
}

type Message = {
  role: "user" | "assistant";
  content: string;
};

type PostBody = {
  conversation_id: string;
  character_id: string;
  messages: Message[];
  turn_range?: string; // "1-10", "11-20" 형식
};

type ExtractedMemory = {
  type: "core_concept" | "timeline" | "relationship";
  content: string;
  importance: number;
  rp_date?: string;
  turn_range?: string;
};

const SYSTEM_PROMPT = `You are a memory extraction assistant for a character roleplay chat application.
Analyze the given conversation and extract memories in exactly three types.
Output ONLY a valid JSON array with no explanation, markdown, or code fences.

=== TYPE DEFINITIONS ===

1. core_concept (핵심 컨셉)
   - Extract the fundamental concepts of THIS roleplay session that must never be forgotten.
   - Includes: setting, world background, initial meeting circumstances, key premises, character roles.
   - Extract up to 10 entries. Skip if the concept is already obvious from a previous core_concept.
   - Do NOT duplicate previously established concepts.
   - importance: 5 (critical) or 4 (important)

2. timeline (사건 타임라인)
   - Extract EXACTLY 1 entry representing the single most important event in this conversation window.
   - content format (Korean): "N~N턴 | [롤플레이 내 날짜 또는 '알 수 없음'] | [사건 내용 간결하게 1~2문장]"
   - rp_date: Extract any in-world date/time mentioned (e.g. "3월 15일", "봄의 첫날"). If none mentioned, use "알 수 없음".
   - turn_range: Use the turn range provided in the request (e.g. "1-10").
   - importance: 4 or 5
   - MUST be exactly 1 item. Do not extract 0 or 2+ timeline entries.

3. relationship (관계도)
   - Extract EXACTLY 1 entry describing the current relationship status between the character and the user.
   - Includes: emotional bond, trust level, affection, tension, dynamic (e.g. "적대 → 호감으로 변화 중").
   - importance: 3, 4, or 5
   - MUST be exactly 1 item.

=== OUTPUT FORMAT ===
Each item must have these fields:
- type: "core_concept" | "timeline" | "relationship"
- content: Korean string, concise
- importance: number 1–5
- rp_date: string (required for timeline, use "알 수 없음" if unknown; omit for other types)
- turn_range: string (required for timeline, e.g. "1-10"; omit for other types)

=== EXAMPLE OUTPUT ===
[
  {"type":"core_concept","content":"배경은 19세기 말 유럽풍 귀족 사회이며, 캐릭터는 공작 가문의 장남이다.","importance":5},
  {"type":"core_concept","content":"유저는 신분을 숨긴 채 가정교사로 저택에 들어온 평민 출신이다.","importance":5},
  {"type":"timeline","content":"1~10턴 | 알 수 없음 | 캐릭터와 유저가 처음 만나 신경전을 벌이며 서로를 탐색했다.","importance":4,"rp_date":"알 수 없음","turn_range":"1-10"},
  {"type":"relationship","content":"초면임에도 캐릭터가 유저에게 묘한 흥미를 느끼고 있으며, 유저는 경계심을 유지 중이다.","importance":4}
]`;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<PostBody>;
    const { conversation_id, character_id, messages, turn_range } = body;

    if (!conversation_id || !character_id || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "conversation_id, character_id, and messages are required." },
        { status: 400 }
      );
    }

    // ── Supabase 인증 ──────────────────────────────────────────────────────
    const cookieStore = await cookies();
    const { url, anonKey } = getSupabaseEnv();

    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── 대화 텍스트 변환 ───────────────────────────────────────────────────
    const turnRangeLabel = turn_range ?? "알 수 없음";
    const conversationText = [
      `[현재 턴 구간: ${turnRangeLabel}]`,
      ...messages.map((m) => (m.role === "user" ? `유저: ${m.content}` : `캐릭터: ${m.content}`)),
    ].join("\n");

    // ── Gemini 기억 추출 요청 ──────────────────────────────────────────────
    const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
    const result = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: [{ role: "user", parts: [{ text: conversationText }] }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
    });
    const rawText = (result.text ?? "").trim();

    // ── JSON 파싱 (코드 펜스 제거) ─────────────────────────────────────────
    let memories: ExtractedMemory[] = [];
    try {
      const cleaned = rawText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      const parsed = JSON.parse(cleaned) as unknown;
      if (Array.isArray(parsed)) {
        memories = parsed as ExtractedMemory[];
      }
    } catch {
      console.warn("[memories/extract] JSON parse failed, returning empty array. raw:", rawText);
    }

    if (memories.length === 0) {
      return NextResponse.json({ saved: 0, memories: [] });
    }

    // ── conversation_memories 타입별 저장 ────────────────────────────────────
    const allInserted: unknown[] = [];

    for (const m of memories) {
      // ── timeline: 동일 turn_range 중복 스킵 ──────────────────────────────
      if (m.type === "timeline") {
        if (m.turn_range) {
          const { data: existing } = await supabase
            .from("conversation_memories")
            .select("id")
            .eq("conversation_id", conversation_id)
            .eq("type", "timeline")
            .eq("turn_range", m.turn_range)
            .maybeSingle();

          if (existing) {
            console.log(`[memories/extract] timeline turn_range ${m.turn_range} 이미 존재, 스킵`);
            continue;
          }
        }
      }

      // ── relationship: 기존 레코드 비활성화 후 새로 insert ────────────────
      if (m.type === "relationship") {
        await supabase
          .from("conversation_memories")
          .update({ is_active: false })
          .eq("conversation_id", conversation_id)
          .eq("type", "relationship")
          .eq("is_active", true);
      }

      // ── insert (core_concept은 그대로 누적) ──────────────────────────────
      const { data: inserted, error: insertError } = await supabase
        .from("conversation_memories")
        .insert({
          conversation_id,
          character_id,
          user_id: user.id,
          type: m.type,
          content: m.content,
          importance: m.importance,
          rp_date: m.rp_date ?? null,
          turn_range: m.turn_range ?? null,
          source: "ai",
          is_active: true,
        })
        .select()
        .single();

      if (insertError) {
        console.error(`[memories/extract] insert error (${m.type}):`, insertError.message);
        continue;
      }

      allInserted.push(inserted);
    }

    return NextResponse.json({ saved: allInserted.length, memories: allInserted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[memories/extract] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
