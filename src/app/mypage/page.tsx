import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { MypageClient } from "./MypageClient";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env vars.");
  return { url, anonKey };
}

export type CreditTransaction = {
  id: string;
  amount: number;
  credit_type: string;
  transaction_type: string;
  description: string | null;
  character_name: string | null;
  created_at: string;
};

export default async function MypagePage() {
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("user_id", user.id)
    .maybeSingle();

  // 크레딧 잔액 + 최근 거래내역
  const [{ data: creditsData }, { data: txData }] = await Promise.all([
    supabase
      .from("user_credits")
      .select("free_balance, paid_balance")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("credit_transactions")
      .select("id, amount, credit_type, transaction_type, description, character_name, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const freeBalance = (creditsData?.free_balance as number | null) ?? 0;
  const paidBalance = (creditsData?.paid_balance as number | null) ?? 0;
  const transactions: CreditTransaction[] = (txData ?? []) as CreditTransaction[];

  return (
    <MypageClient
      email={user.email ?? ""}
      initialNickname={(profile?.nickname as string | null) ?? ""}
      freeBalance={freeBalance}
      paidBalance={paidBalance}
      transactions={transactions}
    />
  );
}
