import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { sendPushToUser, type PushPayload } from "../../../lib/push";

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

// POST /api/push/send
// body: { userId: string, payload: { title, body, url?, tag? } }
// Only allows sending to self (for testing). Server-side code should call
// sendPushToUser() directly instead of hitting this endpoint.
export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getSupabaseWithUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as { userId?: string; payload?: PushPayload };
    const targetUserId = body.userId ?? user.id;
    if (targetUserId !== user.id) {
      return NextResponse.json({ error: "Can only send to self" }, { status: 403 });
    }
    if (!body.payload?.title || !body.payload?.body) {
      return NextResponse.json({ error: "payload.title and payload.body required" }, { status: 400 });
    }

    await sendPushToUser(supabase, targetUserId, body.payload);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
