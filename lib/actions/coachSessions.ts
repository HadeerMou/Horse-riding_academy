"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notifyUser } from "@/lib/notifications";
import { formatSessionDate } from "@/lib/sessions";

// Every redirect carries back the active tab, whether the "show all" toggle
// was on, and which accordion row (a group or a rider) was open — so the
// page reopens to where the coach was instead of resetting to the defaults.
function sessionsUrl(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/coach/sessions?${query}` : "/coach/sessions";
}

function formContext(formData: FormData) {
  return {
    tab: String(formData.get("tab") || ""),
    showAll: String(formData.get("showAll") || ""),
    openId: String(formData.get("openId") || ""),
  };
}

export async function scheduleSession(formData: FormData) {
  const ctx = formContext(formData);
  const enrollmentId = String(formData.get("enrollmentId") || "");
  const date = String(formData.get("date") || "");
  const makeupOfSessionId = String(formData.get("makeupOfSessionId") || "") || null;
  if (!enrollmentId || !date) redirect(sessionsUrl({ error: "invalid", ...ctx }));

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/signin");

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("rider_id")
    .eq("id", enrollmentId)
    .single();
  if (enrollmentError || !enrollment) redirect(sessionsUrl({ error: "unknown", ...ctx }));

  const { error } = await supabase.from("enrollment_sessions").insert({
    enrollment_id: enrollmentId,
    rider_id: enrollment.rider_id,
    session_date: date,
    makeup_of_session_id: makeupOfSessionId,
  });

  if (error) redirect(sessionsUrl({ error: error.code === "23505" ? "duplicate" : "unknown", ...ctx }));

  await notifyUser(
    supabase,
    enrollment.rider_id,
    makeupOfSessionId ? "A makeup session was scheduled for you" : "A new session was scheduled for you",
    formatSessionDate(date),
    "/account"
  );

  revalidatePath("/coach/sessions");
  revalidatePath("/account");
  redirect(sessionsUrl({ scheduled: "1", ...ctx }));
}

export async function markSessionStatus(formData: FormData) {
  const ctx = formContext(formData);
  const sessionId = String(formData.get("sessionId") || "");
  const status = String(formData.get("status") || "");
  if (!sessionId || !["scheduled", "attended", "missed"].includes(status)) {
    redirect(sessionsUrl({ error: "invalid", ...ctx }));
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/signin");

  const { data: session } = await supabase
    .from("enrollment_sessions")
    .select("rider_id, session_date")
    .eq("id", sessionId)
    .maybeSingle();

  const { error } = await supabase.from("enrollment_sessions").update({ status }).eq("id", sessionId);
  if (error) redirect(sessionsUrl({ error: "unknown", ...ctx }));

  if (session && (status === "attended" || status === "missed")) {
    await notifyUser(
      supabase,
      session.rider_id,
      status === "attended" ? "Marked attended" : "Marked missed",
      formatSessionDate(session.session_date),
      "/account"
    );
  }

  revalidatePath("/coach/sessions");
  revalidatePath("/account");
  redirect(sessionsUrl({ updated: "1", ...ctx }));
}

export async function removeSession(formData: FormData) {
  const ctx = formContext(formData);
  const sessionId = String(formData.get("sessionId") || "");
  if (!sessionId) redirect(sessionsUrl({ error: "invalid", ...ctx }));

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/signin");

  const { data: session } = await supabase
    .from("enrollment_sessions")
    .select("rider_id, session_date")
    .eq("id", sessionId)
    .maybeSingle();

  const { error } = await supabase.from("enrollment_sessions").delete().eq("id", sessionId);
  if (error) redirect(sessionsUrl({ error: "unknown", ...ctx }));

  if (session) {
    await notifyUser(supabase, session.rider_id, "A scheduled session was removed", formatSessionDate(session.session_date), "/account");
  }

  revalidatePath("/coach/sessions");
  revalidatePath("/account");
  redirect(sessionsUrl({ removed: "1", ...ctx }));
}

export async function addCapacityOverride(formData: FormData) {
  const ctx = formContext(formData);
  const groupId = String(formData.get("groupId") || "");
  const date = String(formData.get("date") || "");
  const extraSpots = Number(formData.get("extraSpots"));
  if (!groupId || !date || !Number.isInteger(extraSpots) || extraSpots < 1) {
    redirect(sessionsUrl({ error: "invalid", ...ctx }));
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/signin");

  const { error } = await supabase
    .from("group_capacity_overrides")
    .upsert({ group_id: groupId, session_date: date, extra_spots: extraSpots }, { onConflict: "group_id,session_date" });
  if (error) redirect(sessionsUrl({ error: "unknown", ...ctx }));

  revalidatePath("/coach/sessions");
  revalidatePath("/account");
  redirect(sessionsUrl({ spotAdded: "1", ...ctx }));
}

export async function removeCapacityOverride(formData: FormData) {
  const ctx = formContext(formData);
  const overrideId = String(formData.get("overrideId") || "");
  if (!overrideId) redirect(sessionsUrl({ error: "invalid", ...ctx }));

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/signin");

  const { error } = await supabase.from("group_capacity_overrides").delete().eq("id", overrideId);
  if (error) redirect(sessionsUrl({ error: "unknown", ...ctx }));

  revalidatePath("/coach/sessions");
  revalidatePath("/account");
  redirect(sessionsUrl({ spotRemoved: "1", ...ctx }));
}
