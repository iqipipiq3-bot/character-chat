"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase";

const NICKNAME_REGEX = /^[가-힣a-zA-Z0-9]+$/;

function validateNickname(v: string): string | null {
  if (v.length < 2) return "닉네임은 2자 이상이어야 합니다.";
  if (v.length > 20) return "닉네임은 20자 이하여야 합니다.";
  if (!NICKNAME_REGEX.test(v)) return "한글, 영문, 숫자만 사용할 수 있습니다.";
  return null;
}

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [nickname, setNickname] = useState("");
  const [nicknameStatus, setNicknameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [nicknameMessage, setNicknameMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkNickname(value: string) {
    const trimmed = value.trim();
    const validationError = validateNickname(trimmed);
    if (validationError) {
      setNicknameStatus("invalid");
      setNicknameMessage(validationError);
      return;
    }
    setNicknameStatus("checking");
    setNicknameMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("nickname", trimmed)
        .maybeSingle();
      if (data) {
        setNicknameStatus("taken");
        setNicknameMessage("이미 사용 중인 닉네임입니다.");
      } else {
        setNicknameStatus("available");
        setNicknameMessage("사용 가능한 닉네임입니다.");
      }
    } catch {
      setNicknameStatus("idle");
      setNicknameMessage("");
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError("패스워드가 일치하지 않습니다.");
      return;
    }

    const trimmedNickname = nickname.trim();
    const validationError = validateNickname(trimmedNickname);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (nicknameStatus === "taken") {
      setError("이미 사용 중인 닉네임입니다.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();

      // ① 회원가입
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;

      // ② 닉네임 저장 + 가입 보너스 지급
      const userId = data.user?.id;
      if (userId) {
        await supabase.from("profiles").upsert(
          { user_id: userId, nickname: trimmedNickname },
          { onConflict: "user_id" }
        );
        // 세션 쿠키가 설정된 뒤 서버 API로 보너스 지급
        fetch("/api/signup-bonus", { method: "POST" }).catch(() => {});
      }

      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "회원가입에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">회원가입</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          이메일/비밀번호로 계정을 생성합니다.
        </p>

        <form onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-sm font-medium">이메일</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">비밀번호</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">비밀번호 확인</span>
            <input
              type="password"
              required
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </label>

          <div>
            <label className="block">
              <span className="text-sm font-medium">닉네임</span>
              <input
                type="text"
                required
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  setNicknameStatus("idle");
                  setNicknameMessage("");
                }}
                onBlur={() => { if (nickname.trim()) void checkNickname(nickname); }}
                maxLength={20}
                className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                placeholder="한글, 영문, 숫자 2~20자"
                autoComplete="off"
              />
            </label>
            {nicknameStatus === "checking" && (
              <p className="mt-1 text-xs text-zinc-400">확인 중...</p>
            )}
            {nicknameStatus === "available" && (
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">{nicknameMessage}</p>
            )}
            {(nicknameStatus === "taken" || nicknameStatus === "invalid") && (
              <p className="mt-1 text-xs text-red-500">{nicknameMessage}</p>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || nicknameStatus === "taken" || nicknameStatus === "checking"}
            className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900"
          >
            {loading ? "처리 중..." : "회원가입"}
          </button>
        </form>

        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          이미 계정이 있나요?{" "}
          <Link className="font-medium text-zinc-900 dark:text-zinc-50" href="/login">
            로그인
          </Link>
        </p>
      </main>
    </div>
  );
}
