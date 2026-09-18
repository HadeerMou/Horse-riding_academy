"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { RidingLevel } from "@/lib/coach";
import { getUnresolvedMissedGroupSessions } from "@/lib/makeupSessions";
import { notifyCoaches, getRiderDisplayName } from "@/lib/notifications";
import { formatSessionDate } from "@/lib/sessions";

// Local calendar date — see the matching note in lib/makeupSessions.ts on why
// toISOString() isn't used here.
function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function currentMonthPrefix(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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

  const { data: session } = await supabase
    .from("enrollment_sessions")
    .select("session_date, lesson_groups(name)")
    .eq("id", sessionId)
    .eq("rider_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("enrollment_sessions")
    .update({ status: "excused" })
    .eq("id", sessionId)
    .eq("rider_id", user.id)
    .eq("status", "scheduled")
    .gte("session_date", today());
  if (error) redirect("/account?error=unknown");

  if (session) {
    const group = session.lesson_groups as unknown as { name: string } | null;
    const riderName = await getRiderDisplayName(supabase, user.id);
    await notifyCoaches(
      supabase,
      `${riderName} marked a session out`,
      `${formatSessionDate(session.session_date)}${group ? ` — ${group.name}` : " — private session"}`,
      "/coach/sessions?tab=out"
    );
  }

  revalidatePath("/account");
  revalidatePath("/coach/sessions");
  redirect("/account?out=1");
}

// Undoes markSessionOut — only when it's still safe to: the spot can't have
// already been given away to someone else's makeup booking, and this miss
// can't already have been resolved by a makeup booked elsewhere.
export async function markSessionIn(formData: FormData) {
  const sessionId = String(formData.get("sessionId") || "");
  if (!sessionId) redirect("/account?error=invalid");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) redirect("/signin");

  const { data: session } = await supabase
    .from("enrollment_sessions")
    .select("session_date, group_id, lesson_groups(name, level)")
    .eq("id", sessionId)
    .eq("rider_id", user.id)
    .eq("status", "excused")
    .gte("session_date", today())
    .maybeSingle();
  if (!session) redirect("/account?error=invalid");

  const group = session.lesson_groups as unknown as { name: string; level: RidingLevel } | null;

  if (session.group_id && group) {
    const { data: resolvedBy } = await supabase
      .from("enrollment_sessions")
      .select("id")
      .eq("makeup_of_session_id", sessionId)
      .maybeSingle();
    if (resolvedBy) redirect("/account?error=already-made-up");

    const { data: spots, error: spotsError } = await supabase.rpc("open_makeup_spots_for_level", {
      p_level: group.level,
      p_from: session.session_date,
      p_to: session.session_date,
    });
    const stillOpen =
      !spotsError && (spots ?? []).some((s: { group_id: string; available: number }) => s.group_id === session.group_id && s.available > 0);
    if (!stillOpen) redirect("/account?error=spot-taken");
  }

  const { error } = await supabase
    .from("enrollment_sessions")
    .update({ status: "scheduled" })
    .eq("id", sessionId)
    .eq("rider_id", user.id)
    .eq("status", "excused");
  if (error) redirect("/account?error=unknown");

  const riderName = await getRiderDisplayName(supabase, user.id);
  await notifyCoaches(
    supabase,
    `${riderName} is attending after all`,
    `${formatSessionDate(session.session_date)}${group ? ` — ${group.name}` : " — private session"}`,
    "/coach/sessions?tab=out"
  );

  revalidatePath("/account");
  revalidatePath("/coach/sessions");
  redirect("/account?in=1");
}

export async function bookMakeupSpot(formData: FormData) {
  const groupId = String(formData.get("groupId") || "");
  const date = String(formData.get("date") || "");
  // A missed session has to be made up within the same month it was missed —
  // never carried into the next.
  if (!groupId || !date || date < today() || !date.startsWith(currentMonthPrefix())) {
    redirect("/account?error=invalid");
  }

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

  const riderName = await getRiderDisplayName(supabase, user.id);
  await notifyCoaches(
    supabase,
    `${riderName} booked a makeup session`,
    formatSessionDate(date),
    "/coach/sessions?tab=makeup"
  );

  revalidatePath("/account");
  revalidatePath("/coach/sessions");
  redirect("/account?makeup=1");
}
