"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

const CHAT_MODELS = [
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", heartColor: "#FF0000" },
  { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", heartColor: "#FF6B00" },
] as const;

function HeaderHeartIcon({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 21.593c-.525-.507-5.453-5.017-7.005-6.938C2.464 11.977 2 10.025 2 8.196 2 4.771 4.812 2 8.286 2c1.773 0 3.416.808 4.714 2.136C14.298 2.808 15.941 2 17.714 2 21.188 2 24 4.771 24 8.196c0 1.83-.464 3.78-2.995 6.459-1.552 1.921-6.48 6.431-7.005 6.938l-1 .948-1-.948z" />
    </svg>
  );
}
import { createSupabaseBrowserClient } from "./lib/supabase";

type Props = {
  displayName: string | null;
  isLoggedIn: boolean;
  avatarUrl: string | null;
  userId: string | null;
  followerCount: number;
  followingCount: number;
};

export function HeaderClient({ displayName, isLoggedIn, avatarUrl, userId, followerCount, followingCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const isChatPage = pathname?.startsWith("/chat/") ?? false;

  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  const [chatModel, setChatModel] = useState("gemini-2.5-pro");

  useEffect(() => {
    if (isChatPage) {
      setChatModel(localStorage.getItem("chat_model") ?? "gemini-2.5-pro");
    }
  }, [isChatPage]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data, error }) => {
      console.log("[HeaderClient] getSession result:", { session: data.session, error });
    });
  }, []);

  function handleModelChange(value: string) {
    setChatModel(value);
    localStorage.setItem("chat_model", value);
    window.dispatchEvent(new CustomEvent("chatModelChange", { detail: { model: value } }));
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setModelMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    router.push(q ? `/explore?q=${encodeURIComponent(q)}` : "/explore");
  }

  async function handleLogout() {
    setDropdownOpen(false);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-full w-full items-center gap-2 px-4 sm:gap-3 sm:px-6">
      {/* 로고 */}
      <Link
        href="/explore"
        className="shrink-0 text-sm font-bold tracking-tight"
      >
        CC
      </Link>

      {/* 헤더 탭 */}
      <nav className="hidden md:flex items-center gap-1 shrink-0">
        {[
          { href: "/explore", label: "공개 캐릭터" },
          { href: "/dashboard", label: "제작 스튜디오" },
        ].map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              pathname === tab.href || pathname?.startsWith(tab.href + "/")
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {/* 검색창 */}
      <form onSubmit={handleSearchSubmit} className="min-w-0 ml-auto w-full max-w-sm">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="캐릭터, 제작자, 태그 검색..."
            className="h-8 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-8 pr-3 text-xs outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-500"
          />
        </div>
      </form>

      {/* 모델 선택 (채팅 페이지에서만 표시) */}
      {isChatPage && (
        <div className="relative shrink-0" ref={modelMenuRef}>
          <button
            type="button"
            onClick={() => setModelMenuOpen((v) => !v)}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 pl-2.5 pr-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          >
            <HeaderHeartIcon color={CHAT_MODELS.find((m) => m.value === chatModel)?.heartColor ?? "#FF0000"} />
            <span>{CHAT_MODELS.find((m) => m.value === chatModel)?.label ?? "모델 선택"}</span>
            <svg className="h-3 w-3 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {modelMenuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
              {CHAT_MODELS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => { handleModelChange(m.value); setModelMenuOpen(false); }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-900 ${chatModel === m.value ? "font-semibold text-zinc-900 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-400"}`}
                >
                  <HeaderHeartIcon color={m.heartColor} />
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 알림 버튼 */}
      <button
        type="button"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
        aria-label="알림"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-[18px] w-[18px]"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>
      </button>

      {/* 유저 버튼 */}
      {isLoggedIn ? (
        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-[11px] font-semibold uppercase dark:bg-zinc-700">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={displayName ?? ""} className="h-full w-full object-cover" />
              ) : (
                displayName?.charAt(0) ?? "?"
              )}
            </div>
            <span className="hidden max-w-[72px] truncate sm:block">
              {displayName}
            </span>
            <svg
              className="h-3 w-3 text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
              {/* 프로필 상단 카드 */}
              <div className="p-4">
                <div className="flex items-center gap-3">
                  {/* 아바타 (크게) */}
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-xl font-bold uppercase dark:bg-zinc-700">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt={displayName ?? ""} className="h-full w-full object-cover" />
                    ) : (
                      displayName?.charAt(0) ?? "?"
                    )}
                  </div>
                  {/* 이름 + 제작자 페이지 이동 버튼 */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {displayName}
                    </p>
                    {userId && (
                      <Link
                        href={`/creator/${userId}`}
                        onClick={() => setDropdownOpen(false)}
                        className="mt-1 inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                      >
                        제작자 페이지
                        <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                        </svg>
                      </Link>
                    )}
                  </div>
                </div>

                {/* 팔로워 / 팔로잉 */}
                <div className="mt-3 flex gap-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  <Link
                    href={userId ? `/creator/${userId}` : "#"}
                    onClick={() => setDropdownOpen(false)}
                    className="group flex flex-col items-center gap-0.5"
                  >
                    <span className="text-base font-bold text-zinc-900 group-hover:text-zinc-600 dark:text-zinc-50 dark:group-hover:text-zinc-400">
                      {followerCount.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-zinc-500 group-hover:text-zinc-400 dark:text-zinc-500">팔로워</span>
                  </Link>
                  <div className="w-px bg-zinc-100 dark:bg-zinc-800" />
                  <Link
                    href="/mypage"
                    onClick={() => setDropdownOpen(false)}
                    className="group flex flex-col items-center gap-0.5"
                  >
                    <span className="text-base font-bold text-zinc-900 group-hover:text-zinc-600 dark:text-zinc-50 dark:group-hover:text-zinc-400">
                      {followingCount.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-zinc-500 group-hover:text-zinc-400 dark:text-zinc-500">팔로잉</span>
                  </Link>
                </div>
              </div>

              {/* 메뉴 항목들 */}
              <div className="border-t border-zinc-100 py-1 dark:border-zinc-800">
                <Link
                  href="/mypage"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  <svg className="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                  마이페이지
                </Link>
                <Link
                  href="/dashboard"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  <svg className="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                  </svg>
                  제작 스튜디오
                </Link>
              </div>

              {/* 로그아웃 */}
              <div className="border-t border-zinc-100 py-1 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-xs text-red-500 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                  </svg>
                  로그아웃
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <Link
          href="/login"
          className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          로그인
        </Link>
      )}
    </div>
  );
}
