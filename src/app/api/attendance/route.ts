import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env vars.");
  return { url, anonKey };
}

function getKSTDateString() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split("T")[0]!; // "YYYY-MM-DD"
}

function getMonthRange(yearMonth: string) {
  // yearMonth: "YYYY-MM"
  const start = `${yearMonth}-01`;
  const [y, m] = yearMonth.split("-").map(Number) as [number, number];
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${yearMonth}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

// GET /api/attendance?month=YYYY-MM
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const today = getKSTDateString();
    const currentYearMonth = today.slice(0, 7); // "YYYY-MM"
    const month = searchParams.get("month") ?? currentYearMonth;

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

    const { start, end } = getMonthRange(month);

    const { data: checkins } = await supabase
      .from("daily_checkins")
      .select("checked_date")
      .eq("user_id", user.id)
      .gte("checked_date", start)
      .lte("checked_date", end);

    const checkinDates = (checkins ?? []).map((c) => c.checked_date as string);
    const checkedInToday = checkinDates.includes(today);

    return NextResponse.json({
      month,
      today,
      checkin_dates: checkinDates,
      checked_in_today: checkedInToday,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

// POST /api/attendance
export async function POST(_request: NextRequest) {
  // ── 임시 비활성화: 출석 기능 점검 중 ──
  return NextResponse.json(
    { error: '출석 기능이 잠시 점검 중입니다. 곧 재개됩니다.' },
    { status: 503 }
  );
  // ── 임시 비활성화 끝 ──

  try {
    const today = getKSTDateString();
    console.log("[attendance POST] 시작. today =", today);

    const cookieStore = await cookies();
    const { url, anonKey } = getSupabaseEnv();

    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch { /* route handler에서 쿠키 설정 실패는 무시 */ }
        },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("[attendance POST] 인증 실패:", userError?.message);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("[attendance POST] 인증 성공. user.id =", user.id);

    // 이미 오늘 출석했는지 확인
    const { data: existing, error: existingErr } = await supabase
      .from("daily_checkins")
      .select("id")
      .eq("user_id", user.id)
      .eq("checked_date", today)
      .maybeSingle();

    if (existingErr) {
      console.error("[attendance POST] 중복 확인 쿼리 에러:", existingErr.message, existingErr);
      return NextResponse.json({ error: existingErr.message }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json({ error: "already_checked_in" }, { status: 409 });
    }

    // 출석 기록
    console.log("[attendance POST] daily_checkins insert 시도");
    const { error: checkinErr } = await supabase.from("daily_checkins").insert({
      user_id: user.id,
      checked_date: today,
    });

    if (checkinErr) {
      console.error("[attendance POST] daily_checkins insert 에러:", checkinErr.message, checkinErr);
      return NextResponse.json({ error: checkinErr.message }, { status: 500 });
    }
    console.log("[attendance POST] daily_checkins insert 성공");

    // 현재 잔액 조회
    const { data: credits, error: creditsReadErr } = await supabase
      .from("user_credits")
      .select("free_balance, paid_balance")
      .eq("user_id", user.id)
      .maybeSingle();

    if (creditsReadErr) {
      console.error("[attendance POST] user_credits 조회 에러:", creditsReadErr.message, creditsReadErr);
    }
    console.log("[attendance POST] 현재 잔액:", credits);

    const newFreeBalance = (credits?.free_balance ?? 0) + 300;
    const newPaidBalance = credits?.paid_balance ?? 0;

    // 잔액 업데이트
    const { error: creditErr } = await supabase.from("user_credits").upsert(
      { user_id: user.id, free_balance: newFreeBalance, paid_balance: newPaidBalance, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

    if (creditErr) {
      console.error("[attendance POST] user_credits upsert 에러:", creditErr.message, creditErr);
    } else {
      console.log("[attendance POST] user_credits upsert 성공. newFreeBalance =", newFreeBalance);
    }

    // 트랜잭션 기록
    const { error: txErr } = await supabase.from("credit_transactions").insert({
      user_id: user.id,
      amount: 300,
      credit_type: "free",
      transaction_type: "daily_checkin",
      description: "출석 보상",
    });

    if (txErr) {
      console.error("[attendance POST] credit_transactions insert 에러:", txErr.message, txErr);
    } else {
      console.log("[attendance POST] credit_transactions insert 성공");
    }

    return NextResponse.json({
      message: "ok",
      date: today,
      free_balance: newFreeBalance,
    });
  } catch (err) {
    console.error("[attendance API] 500 에러 상세:", err);
    console.error("[attendance API] 에러 메시지:", (err as Error)?.message);
    console.error("[attendance API] 에러 스택:", (err as Error)?.stack);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
