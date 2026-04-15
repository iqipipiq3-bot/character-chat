import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { sendPushToUser } from "../../lib/push";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env vars.");
  return { url, anonKey };
}

async function getSupabase() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch { /* ignore */ }
      },
    },
  });
}

async function requireAdmin(supabase: Awaited<ReturnType<typeof getSupabase>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, isAdmin: false };
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  return { user, isAdmin: profile?.is_admin === true };
}

// GET /api/notices
export async function GET(_request: NextRequest) {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("notices")
      .select("id, title, content, is_pinned, author_id, created_at, updated_at")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ notices: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

// POST /api/notices — 관리자만
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabase();
    const { user, isAdmin } = await requireAdmin(supabase);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json() as { title?: string; content?: string; is_pinned?: boolean };
    if (!body.title?.trim() || !body.content?.trim()) {
      return NextResponse.json({ error: "title, content required" }, { status: 400 });
    }

    const { data: notice, error: insertErr } = await supabase
      .from("notices")
      .insert({
        title: body.title.trim(),
        content: body.content.trim(),
        is_pinned: body.is_pinned === true,
        author_id: user.id,
      })
      .select("id, title, content, is_pinned, author_id, created_at, updated_at")
      .single();

    if (insertErr || !notice) {
      return NextResponse.json({ error: insertErr?.message ?? "insert failed" }, { status: 500 });
    }

    // 전체 유저 대상 알림 INSERT
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("user_id");

    const userIds = (allProfiles ?? []).map((p) => p.user_id as string);
    if (userIds.length > 0) {
      const rows = userIds.map((uid) => ({
        user_id: uid,
        type: "notice",
        title: "새 공지사항",
        message: notice.title,
        link: "/notifications?tab=notices",
        is_read: false,
      }));
      await supabase.from("notifications").insert(rows);

      // 푸시 알림 발송 (실패해도 응답에 영향 없음)
      const payload = {
        title: "새 공지사항",
        body: notice.title as string,
        url: "/notifications?tab=notices",
        tag: `notice-${notice.id}`,
      };
      await Promise.all(
        userIds.map((uid) =>
          sendPushToUser(supabase, uid, payload).catch(() => { /* ignore */ })
        )
      );
    }

    return NextResponse.json({ notice });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
