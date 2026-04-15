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

type SubscriptionJSON = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

// POST /api/push/subscribe
export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getSupabaseWithUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as { subscription?: SubscriptionJSON };
    const subscription = body.subscription;
    if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    // Dedupe by endpoint: remove any existing row with the same endpoint for this user
    const { data: existing } = await supabase
      .from("push_subscriptions")
      .select("id, subscription")
      .eq("user_id", user.id);

    const dupeIds = (existing ?? [])
      .filter((r) => (r.subscription as SubscriptionJSON)?.endpoint === subscription.endpoint)
      .map((r) => r.id as string);
    if (dupeIds.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", dupeIds);
    }

    const { error } = await supabase.from("push_subscriptions").insert({
      user_id: user.id,
      subscription,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE /api/push/subscribe?endpoint=...
export async function DELETE(request: NextRequest) {
  try {
    const { supabase, user } = await getSupabaseWithUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const endpoint = request.nextUrl.searchParams.get("endpoint");
    if (!endpoint) {
      return NextResponse.json({ error: "endpoint required" }, { status: 400 });
    }

    const { data: rows } = await supabase
      .from("push_subscriptions")
      .select("id, subscription")
      .eq("user_id", user.id);

    const ids = (rows ?? [])
      .filter((r) => (r.subscription as SubscriptionJSON)?.endpoint === endpoint)
      .map((r) => r.id as string);

    if (ids.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", ids);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
