"use client";

import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "../lib/supabase";
import type { CreditTransaction } from "./page";

const TX_LABELS: Record<string, string> = {
  signup_bonus: "가입 보상",
  daily_checkin: "출석 보상",
  chat_deduct: "채팅 사용",
  purchase: "큐브 구매",
};

type Props = {
  email: string;
  initialNickname: string;
  freeBalance: number;
  paidBalance: number;
  transactions: CreditTransaction[];
};

export function MypageClient({ email, initialNickname, freeBalance, paidBalance, transactions }: Props) {
  const [nickname, setNickname] = useState(initialNickname);
  const [savingNickname, setSavingNickname] = useState(false);
  const [nicknameError, setNicknameError] = useState<string | null>(null);

  const emailLocalPart = email.split("@")[0] ?? email;

  async function saveNickname() {
    if (savingNickname) return;
    setSavingNickname(true);
    setNicknameError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("로그인이 필요합니다.");
      const { error: upsertError } = await supabase.from("profiles").upsert(
        { user_id: user.id, nickname, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      if (upsertError) throw upsertError;
    } catch (err) {
      setNicknameError(err instanceof Error ? err.message : "닉네임 저장 중 오류가 발생했습니다.");
    } finally {
      setSavingNickname(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-6 py-10 pb-20">
          <header className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight">마이페이지</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              계정 정보와 닉네임을 관리합니다.
            </p>
          </header>

          {/* 큐브 잔액 — 최상단 */}
          <div className="mb-6">
            <h2 className="mb-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">큐브 잔액</h2>
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
              <div className="grid grid-cols-2">
                {/* 무료 큐브 */}
                <div className="flex items-center gap-3 px-5 py-4 border-r border-zinc-100 dark:border-zinc-800">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 shrink-0 text-zinc-400">
                    <path d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18-.21 0-.41-.06-.57-.18l-7.9-4.44A.99.99 0 013 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44C11.59 2.06 11.79 2 12 2c.21 0 .41.06.57.18l7.9 4.44c.32.17.53.5.53.88v9zM12 4.15L6.04 7.5 12 10.85l5.96-3.35L12 4.15zM5 15.91l6 3.38v-6.71L5 9.21v6.7zm8 3.38l6-3.38V9.21l-6 3.37v6.71z" />
                  </svg>
                  <div>
                    <p className="text-xs text-zinc-400">무료 큐브</p>
                    <p className="text-lg font-bold tabular-nums">{freeBalance.toLocaleString()}</p>
                  </div>
                </div>
                {/* 프리즘 큐브 */}
                <div className="flex items-center gap-3 px-5 py-4">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0">
                    <defs>
                      <linearGradient id="prism-grad-mypage" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#a78bfa" />
                        <stop offset="33%" stopColor="#60a5fa" />
                        <stop offset="66%" stopColor="#34d399" />
                        <stop offset="100%" stopColor="#f472b6" />
                      </linearGradient>
                    </defs>
                    <path fill="url(#prism-grad-mypage)" d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18-.21 0-.41-.06-.57-.18l-7.9-4.44A.99.99 0 013 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44C11.59 2.06 11.79 2 12 2c.21 0 .41.06.57.18l7.9 4.44c.32.17.53.5.53.88v9zM12 4.15L6.04 7.5 12 10.85l5.96-3.35L12 4.15zM5 15.91l6 3.38v-6.71L5 9.21v6.7zm8 3.38l6-3.38V9.21l-6 3.37v6.71z" />
                  </svg>
                  <div>
                    <p className="text-xs text-zinc-400">프리즘 큐브</p>
                    <p className="text-lg font-bold tabular-nums">{paidBalance.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">이메일</p>
              <p className="mt-1 text-sm">{email}</p>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                닉네임
              </label>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                닉네임이 없으면 기본으로 이메일 이름 부분({emailLocalPart})이 사용됩니다.
              </p>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
              />
              {nicknameError ? (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">{nicknameError}</p>
              ) : null}
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={savingNickname}
                  onClick={() => void saveNickname()}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {savingNickname ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>

            <Link
              href="/favorites"
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
            >
              <span>⭐ 즐겨찾기 목록 보기</span>
              <span className="text-zinc-400">→</span>
            </Link>

            <Link
              href="/personas"
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
            >
              <span>👤 페르소나 관리</span>
              <span className="text-zinc-400">→</span>
            </Link>

            <Link
              href="/my/following"
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
            >
              <span>👥 팔로우한 크리에이터</span>
              <span className="text-zinc-400">→</span>
            </Link>
          </div>

          {/* 큐브 거래 내역 */}
          <div className="mt-6">
            <h2 className="mb-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">최근 거래 내역</h2>
            {transactions.length === 0 ? (
              <p className="rounded-lg border border-zinc-200 bg-white px-4 py-4 text-sm text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950">
                거래 내역이 없습니다.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800">
                      <th className="px-3 py-2.5 text-left font-medium text-zinc-400">날짜</th>
                      <th className="px-3 py-2.5 text-left font-medium text-zinc-400">구분</th>
                      <th className="px-3 py-2.5 text-right font-medium text-zinc-400">큐브</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-zinc-50 last:border-0 dark:border-zinc-900">
                        <td className="px-3 py-2 text-zinc-400">
                          {new Date(tx.created_at).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}
                        </td>
                        <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">
                          {tx.description ?? TX_LABELS[tx.transaction_type] ?? tx.transaction_type}
                        </td>
                        <td className={`px-3 py-2 text-right font-semibold tabular-nums ${tx.amount > 0 ? "text-green-600 dark:text-green-400" : "text-zinc-500"}`}>
                          {tx.amount > 0 ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
