"use client";

export default function OfflinePage() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="text-5xl">📡</div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">오프라인 상태입니다</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          인터넷 연결을 확인해주세요.
        </p>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        다시 시도
      </button>
    </div>
  );
}
