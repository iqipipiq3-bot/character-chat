"use client";

import { useState, useEffect } from "react";

type Theme = "light" | "dark" | "system";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.remove("dark");
  } else {
    // system: 미디어쿼리 결과 따르기
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }
}

const THEME_OPTIONS: { value: Theme; icon: string; label: string; desc: string }[] = [
  { value: "light", icon: "☀️", label: "라이트", desc: "항상 밝은 테마 사용" },
  { value: "dark", icon: "🌙", label: "다크", desc: "항상 어두운 테마 사용" },
  { value: "system", icon: "💻", label: "시스템 설정", desc: "기기 설정에 따라 자동 전환" },
];

export default function SettingsPage() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as Theme | null;
    if (saved === "light" || saved === "dark" || saved === "system") {
      setTheme(saved);
    }
  }, []);

  function handleThemeChange(next: Theme) {
    setTheme(next);
    localStorage.setItem("theme", next);
    applyTheme(next);
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] md:min-h-[calc(100vh-3rem)] bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="mx-auto max-w-2xl px-4 py-8 pb-24 md:px-6 md:py-10 md:pb-10">
        <h1 className="mb-8 text-2xl font-semibold tracking-tight">설정</h1>

        {/* 테마 섹션 */}
        <section>
          <h2 className="mb-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">테마</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {THEME_OPTIONS.map((opt) => {
              const isSelected = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleThemeChange(opt.value)}
                  className={`relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all ${
                    isSelected
                      ? "border-zinc-900 bg-white shadow-sm dark:border-zinc-100 dark:bg-zinc-900"
                      : "border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
                  }`}
                >
                  {/* 선택 체크 */}
                  {isSelected && (
                    <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-900 dark:bg-zinc-100">
                      <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke={theme === "dark" ? "#000" : "#fff"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}
                  <span className="text-2xl">{opt.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{opt.label}</p>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
