import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env vars.");
  return { url, anonKey };
}

export async function POST(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const { url, anonKey } = getSupabaseEnv();

    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 이미 레코드가 있으면 지급 스킵
    const { data: existing } = await supabase
      .from("user_credits")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ message: "already_initialized" });
    }

    // 신규 레코드 생성 + 트랜잭션 기록
    const [{ error: insertErr }, { error: txErr }] = await Promise.all([
      supabase.from("user_credits").insert({
        user_id: user.id,
        free_balance: 1000,
        paid_balance: 0,
      }),
      supabase.from("credit_transactions").insert({
        user_id: user.id,
        amount: 1000,
        credit_type: "free",
        transaction_type: "signup_bonus",
        description: "신규 가입 보상",
      }),
    ]);

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
    if (txErr) {
      console.error("[signup-bonus] transaction log failed:", txErr.message);
    }

    return NextResponse.json({ message: "ok", free_balance: 1000 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
