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
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch { /* ignore */ }
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

// PATCH /api/lorebook-templates/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, user } = await getSupabaseWithUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as { title?: string; keywords?: string[]; content?: string };
    const { title, keywords, content } = body;
    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: "title and content are required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("lorebook_templates")
      .update({ title: title.trim(), keywords: keywords ?? [], content: content.trim() })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, title, keywords, content, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ template: data });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/lorebook-templates/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, user } = await getSupabaseWithUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error } = await supabase
      .from("lorebook_templates")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
