import "server-only";
import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

let configured = false;

function configure() {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL;
  if (!publicKey || !privateKey || !email) return false;
  webpush.setVapidDetails(email, publicKey, privateKey);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export async function sendPushToUser(
  supabase: SupabaseClient,
  userId: string,
  payload: PushPayload
): Promise<void> {
  if (!configure()) return;

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("user_id", userId);

  if (!subs || subs.length === 0) return;

  const body = JSON.stringify(payload);
  const staleIds: string[] = [];

  await Promise.all(
    subs.map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription as WebPushSubscription, body);
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          staleIds.push(row.id as string);
        }
      }
    })
  );

  if (staleIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", staleIds);
  }
}
