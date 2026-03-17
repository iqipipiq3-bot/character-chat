import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConversationSidebar } from "./ConversationSidebar";
import { HeaderClient } from "./HeaderClient";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Character Chat",
  description: "AI 캐릭터와 대화하세요",
};

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env vars.");
  return { url, anonKey };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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

  let displayName: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("nickname")
      .eq("user_id", user.id)
      .maybeSingle();

    const nickname = (profile?.nickname as string | null) ?? "";
    if (nickname.trim().length > 0) {
      displayName = nickname.trim();
    } else if (user.email) {
      displayName = user.email.split("@")[0] ?? user.email;
    } else {
      displayName = "사용자";
    }
  }

  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* 상단 고정 헤더 */}
        <header className="fixed left-0 right-0 top-0 z-50 h-12 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-black/70">
          <HeaderClient displayName={displayName} isLoggedIn={!!user} />
        </header>
        {/* 고정 사이드바 — /explore, /dashboard에서만 표시 */}
        <ConversationSidebar />
        {/* 헤더 높이만큼 오프셋 */}
        <div className="pt-12">
          {children}
        </div>
      </body>
    </html>
  );
}
