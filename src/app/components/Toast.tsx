"use client";

import { useEffect, useState } from "react";

type ToastItem = { id: number; message: string; type: "success" | "error" };
let _id = 0;

export function showToast(message: string, type: "success" | "error" = "success") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("app:toast", { detail: { message, type } }));
  }
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    function handler(e: Event) {
      const { message, type } = (e as CustomEvent<{ message: string; type: "success" | "error" }>).detail;
      const id = ++_id;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
    }
    window.addEventListener("app:toast", handler);
    return () => window.removeEventListener("app:toast", handler);
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-6 right-4 z-[200] flex flex-col items-end gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl ${
            t.type === "error"
              ? "bg-red-500"
              : "bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
