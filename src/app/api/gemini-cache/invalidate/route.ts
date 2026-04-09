import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { GoogleGenAI } from "@google/genai";

type InvalidateBody = {
  character_id?: string;
};

type ConversationCacheRow = {
  gemini_cache_id: string | null;
};

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

function getAI() {
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!);
  return new GoogleGenAI({
    vertexai: true,
    project: process.env.GOOGLE_CLOUD_PROJECT_ID!,
    location: process.env.GOOGLE_CLOUD_LOCATION!,
    googleAuthOptions: { credentials },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as InvalidateBody;
    const characterId = body.character_id?.trim();

    if (!characterId) {
      return NextResponse.json({ error: "character_id is required." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const { url, anonKey } = getSupabaseEnv();

    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: character, error: characterError } = await supabase
      .from("characters")
      .select("id, user_id")
      .eq("id", characterId)
      .maybeSingle();

    if (characterError) {
      return NextResponse.json({ error: characterError.message }, { status: 400 });
    }

    if (!character || character.user_id !== user.id) {
      return NextResponse.json({ error: "Character not found." }, { status: 404 });
    }

    const { data: conversationCaches, error: conversationError } = await supabase
      .from("conversations")
      .select("gemini_cache_id")
      .eq("character_id", characterId)
      .not("gemini_cache_id", "is", null);

    if (conversationError) {
      return NextResponse.json({ error: conversationError.message }, { status: 400 });
    }

    const uniqueCacheIds = Array.from(
      new Set(
        ((conversationCaches ?? []) as ConversationCacheRow[])
          .map((row) => row.gemini_cache_id)
          .filter((cacheId): cacheId is string => Boolean(cacheId))
      )
    );

    if (uniqueCacheIds.length > 0) {
      const ai = getAI();
      await Promise.all(
        uniqueCacheIds.map(async (cacheId) => {
          try {
            await ai.caches.delete({ name: cacheId });
          } catch (error) {
            console.error("[gemini-cache] remote delete failed:", cacheId, error);
          }
        })
      );
    }

    const { error: clearError } = await supabase
      .from("conversations")
      .update({ gemini_cache_id: null, cache_expires_at: null })
      .eq("character_id", characterId);

    if (clearError) {
      return NextResponse.json({ error: clearError.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      deleted_remote_cache_count: uniqueCacheIds.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
