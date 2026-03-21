"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { HeaderClient } from "./HeaderClient";

type Props = {
  displayName: string | null;
  isLoggedIn: boolean;
  avatarUrl: string | null;
};

export function HeaderShell({ displayName, isLoggedIn, avatarUrl }: Props) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  if (isAuthPage) return null;

  return (
    <header className="fixed left-0 right-0 top-0 z-50 h-12 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-black/70">
      <HeaderClient displayName={displayName} isLoggedIn={isLoggedIn} avatarUrl={avatarUrl} />
    </header>
  );
}

export function HeaderPadding({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  return (
    <div className={isAuthPage ? "" : "pt-12"}>
      {children}
    </div>
  );
}
