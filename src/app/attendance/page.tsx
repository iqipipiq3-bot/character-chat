import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { AttendanceClient } from "./AttendanceClient";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env vars.");
  return { url, anonKey };
}

function getKSTDateString() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split("T")[0]!;
}

export default async function AttendancePage() {
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
  if (!user) redirect("/login");

  const today = getKSTDateString();
  const month = today.slice(0, 7);
  const [year, monthNum] = month.split("-").map(Number) as [number, number];
  const lastDay = new Date(year, monthNum, 0).getDate();
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;

  // 이번 달 출석 데이터
  const { data: checkins } = await supabase
    .from("daily_checkins")
    .select("checked_date")
    .eq("user_id", user.id)
    .gte("checked_date", monthStart)
    .lte("checked_date", monthEnd);

  const checkinDates = (checkins ?? []).map((c) => c.checked_date as string);
  const checkedInToday = checkinDates.includes(today);

  // 연속 출석 계산을 위해 최근 62일 데이터 조회
  const streakFrom = new Date(Date.now() + 9 * 60 * 60 * 1000);
  streakFrom.setDate(streakFrom.getDate() - 62);
  const streakFromStr = streakFrom.toISOString().split("T")[0]!;

  const { data: recentCheckins } = await supabase
    .from("daily_checkins")
    .select("checked_date")
    .eq("user_id", user.id)
    .gte("checked_date", streakFromStr)
    .lte("checked_date", today);

  const recentDateSet = new Set((recentCheckins ?? []).map((c) => c.checked_date as string));

  let streakDays = 0;
  let cur = today;
  while (recentDateSet.has(cur)) {
    streakDays++;
    const d = new Date(cur + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    cur = d.toISOString().split("T")[0]!;
  }

  return (
    <AttendanceClient
      month={month}
      today={today}
      initialCheckinDates={checkinDates}
      initialCheckedInToday={checkedInToday}
      initialStreakDays={streakDays}
    />
  );
}
