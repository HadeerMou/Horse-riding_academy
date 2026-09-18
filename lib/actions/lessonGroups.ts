"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RIDING_LEVELS } from "@/lib/coach";
import { notifyUser } from "@/lib/notifications";

// The list page reopens whichever level's accordion was open instead of
// collapsing back to all-closed after an action.
function groupsUrl(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/coach/groups?${query}` : "/coach/groups";
}

function groupUrl(groupId: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/coach/groups/${groupId}?${query}` : `/coach/groups/${groupId}`;
}

function parseWeekdays(formData: FormData): number[] | null {
  const weekdays = formData.getAll("weekdays").map(Number);
  if (weekdays.length === 0 || weekdays.some((w) => !Number.isInteger(w) || w < 0 || w > 6)) return null;
  return [...new Set(weekdays)];
}

export async function createLessonGroup(formData: FormData) {
  const level = String(formData.get("level") || "");
  const name = String(formData.get("name") || "").trim();
  const capacity = Number(formData.get("capacity"));
  const timeSlotId = String(formData.get("timeSlotId") || "");
  const weekdays = parseWeekdays(formData);
  if (
    !RIDING_LEVELS.includes(level as (typeof RIDING_LEVELS)[number]) ||
    !name ||
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    !timeSlotId ||
    !weekdays
  ) {
    redirect(groupsUrl({ error: "invalid", level }));
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/signin");

  const { data: slot, error: slotError } = await supabase
    .from("class_time_slots")
    .select("start_time, end_time")
    .eq("id", timeSlotId)
    .single();
  if (slotError || !slot) redirect(groupsUrl({ error: "invalid", level }));

  const { data: group, error: groupError } = await supabase
    .from("lesson_groups")
    .insert({ level, name, capacity })
    .select("id")
    .single();
  if (groupError || !group) redirect(groupsUrl({ error: "unknown", level }));

  const { error } = await supabase.from("group_meeting_times").insert(
    weekdays.map((weekday) => ({
      group_id: group.id,
      weekday,
      start_time: slot.start_time,
      end_time: slot.end_time,
    }))
  );
  if (error) redirect(groupsUrl({ error: "unknown", level }));

  revalidatePath("/coach/groups");
  revalidatePath("/coach");
  redirect(groupsUrl({ created: "1", level }));
}

export async function updateLessonGroup(formData: FormData) {
  const groupId = String(formData.get("groupId") || "");
  const name = String(formData.get("name") || "").trim();
  const capacity = Number(formData.get("capacity"));
  const active = formData.get("active") === "on";
  if (!groupId || !name || !Number.isInteger(capacity) || capacity < 1) {
    redirect(groupUrl(groupId, { error: "invalid" }));
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/signin");

  const { error } = await supabase.from("lesson_groups").update({ name, capacity, active }).eq("id", groupId);
  if (error) redirect(groupUrl(groupId, { error: "unknown" }));

  revalidatePath("/coach/groups");
  revalidatePath(`/coach/groups/${groupId}`);
  revalidatePath("/coach");
  revalidatePath("/account");
  redirect(groupUrl(groupId, { updated: "1" }));
}

export async function deleteLessonGroup(formData: FormData) {
  const level = String(formData.get("level") || "");
  const groupId = String(formData.get("groupId") || "");
  if (!groupId) redirect(groupsUrl({ error: "invalid", level }));

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/signin");

  // Check membership up front rather than deleting sessions and then letting
  // the group delete itself fail on the FK restriction below — otherwise a
  // blocked delete would still have destroyed the group's session history
  // for nothing.
  const { count: memberCount } = await supabase
    .from("lesson_group_members")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId);
  if (memberCount && memberCount > 0) redirect(groupUrl(groupId, { error: "has-members" }));

  // The group itself is going away entirely, so its session history goes
  // with it — otherwise these rows would linger forever with group_id set to
  // null (the foreign key's on-delete behavior) and no way to tell which
  // group they used to belong to.
  await supabase.from("enrollment_sessions").delete().eq("group_id", groupId);

  const { error } = await supabase.from("lesson_groups").delete().eq("id", groupId);
  if (error) redirect(groupUrl(groupId, { error: "unknown" }));

  revalidatePath("/coach/groups");
  revalidatePath("/coach");
  redirect(groupsUrl({ deleted: "1", level }));
}

export async function addMeetingTime(formData: FormData) {
  const groupId = String(formData.get("groupId") || "");
  const weekday = Number(formData.get("weekday"));
  const timeSlotId = String(formData.get("timeSlotId") || "");
  if (!groupId || !Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !timeSlotId) {
    redirect(groupUrl(groupId, { error: "invalid" }));
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/signin");

  const { data: slot, error: slotError } = await supabase
    .from("class_time_slots")
    .select("start_time, end_time")
    .eq("id", timeSlotId)
    .single();
  if (slotError || !slot) redirect(groupUrl(groupId, { error: "invalid" }));

  const { error } = await supabase.from("group_meeting_times").insert({
    group_id: groupId,
    weekday,
    start_time: slot.start_time,
    end_time: slot.end_time,
  });
  if (error) redirect(groupUrl(groupId, { error: error.code === "23505" ? "duplicate-time" : "unknown" }));

  revalidatePath("/coach/groups");
  revalidatePath(`/coach/groups/${groupId}`);
  revalidatePath("/coach");
  revalidatePath("/account");
  redirect(groupUrl(groupId, { timeAdded: "1" }));
}

export async function removeMeetingTime(formData: FormData) {
  const groupId = String(formData.get("groupId") || "");
  const meetingTimeId = String(formData.get("meetingTimeId") || "");
  if (!meetingTimeId) redirect(groupUrl(groupId, { error: "invalid" }));

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/signin");

  const { data: meetingTime, error: meetingTimeError } = await supabase
    .from("group_meeting_times")
    .select("weekday")
    .eq("id", meetingTimeId)
    .single();
  if (meetingTimeError || !meetingTime) redirect(groupUrl(groupId, { error: "unknown" }));

  const { error } = await supabase.from("group_meeting_times").delete().eq("id", meetingTimeId);
  if (error) redirect(groupUrl(groupId, { error: "unknown" }));

  // That weekday is no longer part of the group's schedule — drop any
  // already-auto-scheduled future sessions that fell on it. Past/already-
  // taken attendance stays untouched.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const { data: futureScheduled } = await supabase
    .from("enrollment_sessions")
    .select("id, session_date")
    .eq("group_id", groupId)
    .eq("status", "scheduled")
    .gte("session_date", today);
  const staleIds = (futureScheduled ?? [])
    .filter((row) => new Date(`${row.session_date}T00:00:00`).getDay() === meetingTime.weekday)
    .map((row) => row.id);
  if (staleIds.length > 0) {
    await supabase.from("enrollment_sessions").delete().in("id", staleIds);
  }

  revalidatePath("/coach/groups");
  revalidatePath(`/coach/groups/${groupId}`);
  revalidatePath("/coach");
  revalidatePath("/account");
  redirect(groupUrl(groupId, { timeRemoved: "1" }));
}

export async function addGroupMember(formData: FormData) {
  const groupId = String(formData.get("groupId") || "");
  const enrollmentId = String(formData.get("enrollmentId") || "");
  if (!groupId || !enrollmentId) redirect(groupUrl(groupId, { error: "invalid" }));

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/signin");

  const { data: group, error: groupError } = await supabase
    .from("lesson_groups")
    .select("name, capacity, lesson_group_members(id)")
    .eq("id", groupId)
    .single();
  if (groupError || !group) redirect(groupUrl(groupId, { error: "unknown" }));

  const memberCount = ((group.lesson_group_members ?? []) as unknown[]).length;
  if (memberCount >= group.capacity) redirect(groupUrl(groupId, { error: "full" }));

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("rider_id")
    .eq("id", enrollmentId)
    .single();
  if (enrollmentError || !enrollment) redirect(groupUrl(groupId, { error: "unknown" }));

  const { error } = await supabase.from("lesson_group_members").insert({
    group_id: groupId,
    enrollment_id: enrollmentId,
    rider_id: enrollment.rider_id,
  });

  if (error) {
    redirect(groupUrl(groupId, { error: error.code === "23505" ? "duplicate" : "unknown" }));
  }

  // Schedule the rest of this month's classes for her right away, rather
  // than waiting for the next lazy call on /account or /coach/sessions.
  await supabase.rpc("ensure_group_sessions_for_month");

  await notifyUser(supabase, enrollment.rider_id, "You've been added to a group", group.name, "/account");

  revalidatePath("/coach/groups");
  revalidatePath(`/coach/groups/${groupId}`);
  revalidatePath("/coach");
  revalidatePath("/account");
  redirect(groupUrl(groupId, { added: "1" }));
}

export async function removeGroupMember(formData: FormData) {
  const groupId = String(formData.get("groupId") || "");
  const membershipId = String(formData.get("membershipId") || "");
  if (!membershipId) redirect(groupUrl(groupId, { error: "invalid" }));

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/signin");

  const { data: membership, error: membershipError } = await supabase
    .from("lesson_group_members")
    .select("enrollment_id, group_id, rider_id, lesson_groups(name)")
    .eq("id", membershipId)
    .single();
  if (membershipError || !membership) redirect(groupUrl(groupId, { error: "unknown" }));

  const { error } = await supabase.from("lesson_group_members").delete().eq("id", membershipId);
  if (error) redirect(groupUrl(groupId, { error: "unknown" }));

  // Drop her already-auto-scheduled future classes for this group — she's no
  // longer expected at them. Past/already-taken attendance stays untouched.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  await supabase
    .from("enrollment_sessions")
    .delete()
    .eq("enrollment_id", membership.enrollment_id)
    .eq("group_id", membership.group_id)
    .eq("status", "scheduled")
    .gte("session_date", today);

  const group = membership.lesson_groups as unknown as { name: string } | null;
  await notifyUser(supabase, membership.rider_id, "You've been removed from a group", group?.name, "/account");

  revalidatePath("/coach/groups");
  revalidatePath(`/coach/groups/${groupId}`);
  revalidatePath("/coach");
  revalidatePath("/account");
  redirect(groupUrl(groupId, { removed: "1" }));
}
