import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env vars.");
  return { url, anonKey };
}

async function getSupabaseWithUser() {
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

  const { data: { user }, error } = await supabase.auth.getUser();
  return { supabase, user, error };
}

// ── GET: 활성 기억 목록 조회 ─────────────────────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params;
    const { supabase, user } = await getSupabaseWithUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("conversation_memories")
      .select("id, memory_type, content, importance, source, created_at, updated_at")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("importance", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ memories: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── POST: 유저가 기억 직접 추가 ──────────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params;
    const { supabase, user } = await getSupabaseWithUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      character_id?: string;
      memory_type?: string;
      content?: string;
      importance?: number;
    };

    const { character_id, memory_type, content, importance } = body;

    if (!character_id || !memory_type || !content) {
      return NextResponse.json(
        { error: "character_id, memory_type, and content are required." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("conversation_memories")
      .insert({
        conversation_id: conversationId,
        character_id,
        user_id: user.id,
        memory_type: memory_type,
        content,
        importance: importance ?? 3,
        source: "user",
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ memory: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── PATCH: 기억 수정 또는 비활성화 ───────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params;
    const { supabase, user } = await getSupabaseWithUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      memory_id?: string;
      content?: string;
      importance?: number;
      is_active?: boolean;
    };

    const { memory_id, content, importance, is_active } = body;

    if (!memory_id) {
      return NextResponse.json({ error: "memory_id is required." }, { status: 400 });
    }

    // content / importance / is_active 중 하나 이상 있어야 함
    if (content === undefined && importance === undefined && is_active === undefined) {
      return NextResponse.json(
        { error: "At least one of content, importance, or is_active is required." },
        { status: 400 }
      );
    }

    // 본인 기억인지 확인
    const { data: existing, error: fetchError } = await supabase
      .from("conversation_memories")
      .select("id, user_id")
      .eq("id", memory_id)
      .eq("conversation_id", conversationId)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 400 });
    }
    if (!existing) {
      return NextResponse.json({ error: "Memory not found." }, { status: 404 });
    }
    if ((existing as { user_id: string }).user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 변경할 필드만 구성
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (content !== undefined) updates.content = content;
    if (importance !== undefined) updates.importance = importance;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data, error } = await supabase
      .from("conversation_memories")
      .update(updates)
      .eq("id", memory_id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ memory: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
