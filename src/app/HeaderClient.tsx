"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "./lib/supabase";

type Props = {
  displayName: string | null;
  isLoggedIn: boolean;
};

export function HeaderClient({ displayName, isLoggedIn }: Props) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
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

      {/* 검색창 */}
      <form onSubmit={handleSearchSubmit} className="min-w-0 flex-1">
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
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-[11px] font-semibold uppercase dark:bg-zinc-700">
              {displayName?.charAt(0) ?? "?"}
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
            <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
              <Link
                href="/mypage"
                onClick={() => setDropdownOpen(false)}
                className="block px-4 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                마이페이지
              </Link>
              <Link
                href="/dashboard"
                onClick={() => setDropdownOpen(false)}
                className="block px-4 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                내 캐릭터
              </Link>
              <Link
                href="/settings"
                onClick={() => setDropdownOpen(false)}
                className="block px-4 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                설정
              </Link>
              <hr className="my-1 border-zinc-100 dark:border-zinc-800" />
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="w-full px-4 py-2 text-left text-xs text-red-500 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                로그아웃
              </button>
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
