"use client";

import { useEffect } from "react";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

type Props = { isLoggedIn: boolean };

export function PushSubscriber({ isLoggedIn }: Props) {
  // Register the service worker for all visitors (PWA offline support),
  // independent of login state.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => { /* ignore */ });
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublic) return;

    let cancelled = false;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;

        if (Notification.permission === "denied") return;
        if (Notification.permission === "default") {
          // 최초 1회만 요청 — localStorage로 플래그
          if (localStorage.getItem("push-permission-asked") === "1") return;
          localStorage.setItem("push-permission-asked", "1");
          const permission = await Notification.requestPermission();
          if (permission !== "granted") return;
        }

        const existing = await reg.pushManager.getSubscription();
        if (cancelled) return;

        const sub =
          existing ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublic),
          }));

        if (cancelled) return;

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        });
      } catch {
        // 무시 — 브라우저가 지원 안 하거나 권한 거부됨
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  return null;
}
