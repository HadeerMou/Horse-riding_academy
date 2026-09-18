import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  read: boolean;
  createdAt: string;
};

export async function getMyNotifications(limit = 30): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, url, read, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    url: row.url,
    read: row.read,
    createdAt: row.created_at,
  }));
}

export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("read", false);
  if (error) throw error;
  return count ?? 0;
}

// Riders don't carry full_name/email in most action forms — this centralizes
// the lookup so notification text can name who did what.
export async function getRiderDisplayName(supabase: SupabaseClient, riderId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("full_name, email").eq("id", riderId).maybeSingle();
  return data?.full_name || data?.email || "A rider";
}

// Called from a server action that already holds an authenticated client for
// the *acting* user, to notify a different user about what just happened.
// Best-effort: never blocks or fails the action it's called from.
export async function notifyUser(supabase: SupabaseClient, userId: string, title: string, body?: string, url?: string): Promise<void> {
  await supabase.rpc("create_notification", {
    p_user_id: userId,
    p_title: title,
    p_body: body ?? null,
    p_url: url ?? null,
  });
}

export async function notifyCoaches(supabase: SupabaseClient, title: string, body?: string, url?: string): Promise<void> {
  await supabase.rpc("notify_coaches", { p_title: title, p_body: body ?? null, p_url: url ?? null });
}
