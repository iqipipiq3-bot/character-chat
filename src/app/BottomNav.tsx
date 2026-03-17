"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav() {
  const pathname = usePathname();

  const tabs = [
    { href: "/explore", label: "공개 캐릭터" },
    { href: "/dashboard", label: "내 캐릭터 목록" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 w-full border-t border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-black/80">
      <div className="mx-auto flex max-w-3xl items-center justify-around px-4 py-2 text-xs">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center gap-1 rounded-md px-3 py-1 ${
              pathname === tab.href
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
            <span>{tab.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
