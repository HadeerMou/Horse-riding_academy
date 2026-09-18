"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { RidingLevel } from "@/lib/coach";
import { getUnresolvedMissedGroupSessions } from "@/lib/makeupSessions";

// Local calendar date — see the matching note in lib/makeupSessions.ts on why
// toISOString() isn't used here.
function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

// A rider's group classes are already auto-scheduled for the month (see
// ensure_group_sessions_for_month), so marking one — group or private — "out"
// is always an update on an existing row, never a fresh insert.
export async function markSessionOut(formData: FormData) {
  const sessionId = String(formData.get("sessionId") || "");
  if (!sessionId) redirect("/account?error=invalid");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) redirect("/signin");

  const { error } = await supabase
    .from("enrollment_sessions")
    .update({ status: "excused" })
    .eq("id", sessionId)
    .eq("rider_id", user.id)
    .eq("status", "scheduled")
    .gte("session_date", today());
  if (error) redirect("/account?error=unknown");

  revalidatePath("/account");
  revalidatePath("/coach/sessions");
  redirect("/account?out=1");
}

export async function bookMakeupSpot(formData: FormData) {
  const groupId = String(formData.get("groupId") || "");
  const date = String(formData.get("date") || "");
  if (!groupId || !date || date < today()) redirect("/account?error=invalid");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) redirect("/signin");

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("id, plans(level)")
    .eq("rider_id", user.id)
    .eq("session_type", "group")
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const riderLevel = (enrollment?.plans as unknown as { level: RidingLevel } | null)?.level;
  if (enrollmentError || !enrollment || !riderLevel) redirect("/account?error=invalid");

  const { data: group, error: groupError } = await supabase
    .from("lesson_groups")
    .select("level")
    .eq("id", groupId)
    .single();
  if (groupError || !group || group.level !== riderLevel) redirect("/account?error=invalid");

  const unresolved = await getUnresolvedMissedGroupSessions(enrollment.id);
  const missedSession = unresolved[0];
  if (!missedSession) redirect("/account?error=no-missed-sessions");

  const { data: spots, error: spotsError } = await supabase.rpc("open_makeup_spots_for_level", {
    p_level: riderLevel,
    p_from: date,
    p_to: date,
  });
  const hasOpenSpot = !spotsError && (spots ?? []).some((s: { group_id: string; available: number }) => s.group_id === groupId && s.available > 0);
  if (!hasOpenSpot) redirect("/account?error=spot-taken");

  const { error } = await supabase.from("enrollment_sessions").insert({
    enrollment_id: enrollment.id,
    rider_id: user.id,
    group_id: groupId,
    session_date: date,
    status: "scheduled",
    makeup_of_session_id: missedSession.id,
  });
  if (error) redirect(error.code === "23505" ? "/account?error=already-booked" : "/account?error=unknown");

  revalidatePath("/account");
  revalidatePath("/coach/sessions");
  redirect("/account?makeup=1");
}
