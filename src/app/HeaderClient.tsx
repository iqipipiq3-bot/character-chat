"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "./lib/supabase";
import { useHeaderStore } from "./context/HeaderContext";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { checkedInToday: localCheckedIn, freeBalance: localFreeBalance, paidBalance: localPaidBalance } = useHeaderStore();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!isLoggedIn) return;
    (async () => {
      try {
        const res = await fetch("/api/notifications");
        if (res.ok) {
          const json = await res.json() as { unread_count?: number };
          setUnreadCount(json.unread_count ?? 0);
        }
      } catch { /* ignore */ }
    })();
  }, [isLoggedIn, pathname]);

  useEffect(() => {
    if (mobileSearchOpen) {
      mobileSearchRef.current?.focus();
    }
  }, [mobileSearchOpen]);


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
      <Link href="/explore" className="flex shrink-0 items-center gap-1.5" aria-label="홈">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/launchericon-192x192.png"
          alt="로고"
          width={32}
          height={32}
          style={{ borderRadius: "8px" }}
        />
        <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">CUBE</span>
      </Link>

      {/* 헤더 탭 (데스크탑만) */}
      <nav className="hidden md:flex items-center gap-1 shrink-0 ml-6">
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

      {/* 검색창 (데스크탑) */}
      <form onSubmit={handleSearchSubmit} className="hidden md:block min-w-0 ml-auto w-full max-w-sm">
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

      {/* 모바일 검색창 (펼쳐질 때) */}
      {mobileSearchOpen && (
        <form onSubmit={(e) => { handleSearchSubmit(e); setMobileSearchOpen(false); }} className="absolute left-0 right-0 top-0 z-10 flex h-14 items-center gap-2 bg-white px-4 dark:bg-zinc-950 md:hidden">
          <button
            type="button"
            onClick={() => setMobileSearchOpen(false)}
            className="shrink-0 text-zinc-500"
            aria-label="검색 닫기"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="relative flex-1">
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
              ref={mobileSearchRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="캐릭터, 제작자, 태그 검색..."
              className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-8 pr-3 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-500"
            />
          </div>
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            검색
          </button>
        </form>
      )}

      {/* 모바일 오른쪽 아이콘 영역 */}
      <div className="ml-auto flex items-center gap-0.5 md:hidden">
        {/* 검색 아이콘 버튼 */}
        <button
          type="button"
          onClick={() => setMobileSearchOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          aria-label="검색"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
          </svg>
        </button>

        {/* 출석 아이콘 (로그인 시만, 모바일) */}
        {isLoggedIn && (
          <Link
            href="/attendance"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            aria-label="출석"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            {!localCheckedIn && (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
            )}
          </Link>
        )}

        {/* 알림(공지) 아이콘 (모바일) */}
        <Link
          href="/notifications"
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          aria-label="알림"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
          {isLoggedIn && unreadCount > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>

        {/* 유저 아이콘 (모바일) → 마이페이지 이동 */}
        {isLoggedIn ? (
          <Link
            href="/mypage"
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-[11px] font-semibold uppercase dark:bg-zinc-700">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={displayName ?? ""} className="h-full w-full object-cover" />
              ) : (
                displayName?.charAt(0) ?? "?"
              )}
            </div>
          </Link>
        ) : (
          <Link
            href="/login"
            className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            로그인
          </Link>
        )}
      </div>

      {/* 출석 아이콘 (데스크탑) */}
      {isLoggedIn && (
        <Link
          href="/attendance"
          className="relative hidden md:flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          aria-label="출석"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-[18px] w-[18px]">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
          {!localCheckedIn && (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
          )}
        </Link>
      )}

      {/* 알림 버튼 (데스크탑) */}
      <Link
        href="/notifications"
        className="relative hidden md:flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
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
        {isLoggedIn && unreadCount > 0 && (
          <span className="absolute right-0 top-0 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Link>

      {/* 유저 버튼 (데스크탑) */}
      {isLoggedIn ? (
        <div className="relative hidden md:block shrink-0" ref={dropdownRef}>
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

                {/* 1줄: 팔로워 / 팔로잉 */}
                <div className="mt-3 grid grid-cols-2 divide-x divide-zinc-100 border-t border-zinc-100 pt-3 dark:divide-zinc-800 dark:border-zinc-800">
                  <Link
                    href={userId ? `/creator/${userId}` : "#"}
                    onClick={() => setDropdownOpen(false)}
                    className="group flex flex-col items-center gap-0.5 px-2"
                  >
                    <span className="text-sm font-bold text-zinc-900 group-hover:text-zinc-600 dark:text-zinc-50 dark:group-hover:text-zinc-400">
                      {followerCount.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-zinc-500 group-hover:text-zinc-400 dark:text-zinc-500">팔로워</span>
                  </Link>
                  <Link
                    href="/my/following"
                    onClick={() => setDropdownOpen(false)}
                    className="group flex flex-col items-center gap-0.5 px-2"
                  >
                    <span className="text-sm font-bold text-zinc-900 group-hover:text-zinc-600 dark:text-zinc-50 dark:group-hover:text-zinc-400">
                      {followingCount.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-zinc-500 group-hover:text-zinc-400 dark:text-zinc-500">팔로잉</span>
                  </Link>
                </div>

                {/* 2줄: 무료큐브 / 프리즘큐브 */}
                <div className="mt-3 grid grid-cols-2 divide-x divide-zinc-100 border-t border-zinc-100 pt-3 pb-1 dark:divide-zinc-800 dark:border-zinc-800">
                  {/* 무료 큐브 */}
                  <div className="flex flex-col items-center gap-0.5 px-2">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-zinc-400">
                      <path d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18-.21 0-.41-.06-.57-.18l-7.9-4.44A.99.99 0 013 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44C11.59 2.06 11.79 2 12 2c.21 0 .41.06.57.18l7.9 4.44c.32.17.53.5.53.88v9zM12 4.15L6.04 7.5 12 10.85l5.96-3.35L12 4.15zM5 15.91l6 3.38v-6.71L5 9.21v6.7zm8 3.38l6-3.38V9.21l-6 3.37v6.71z" />
                    </svg>
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                      {localFreeBalance.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-500">무료 큐브</span>
                  </div>
                  {/* 프리즘 큐브 */}
                  <div className="flex flex-col items-center gap-0.5 px-2">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0">
                      <defs>
                        <linearGradient id="prism-grad-dropdown" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#a78bfa" />
                          <stop offset="33%" stopColor="#60a5fa" />
                          <stop offset="66%" stopColor="#34d399" />
                          <stop offset="100%" stopColor="#f472b6" />
                        </linearGradient>
                      </defs>
                      <path fill="url(#prism-grad-dropdown)" d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18-.21 0-.41-.06-.57-.18l-7.9-4.44A.99.99 0 013 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44C11.59 2.06 11.79 2 12 2c.21 0 .41.06.57.18l7.9 4.44c.32.17.53.5.53.88v9zM12 4.15L6.04 7.5 12 10.85l5.96-3.35L12 4.15zM5 15.91l6 3.38v-6.71L5 9.21v6.7zm8 3.38l6-3.38V9.21l-6 3.37v6.71z" />
                    </svg>
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                      {localPaidBalance.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-500">프리즘 큐브</span>
                  </div>
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
                <Link
                  href="/settings"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  <svg className="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                  설정
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
          className="hidden md:inline-flex shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          로그인
        </Link>
      )}
    </div>
  );
}
