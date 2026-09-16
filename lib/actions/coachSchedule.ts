"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function parseSlotFields(formData: FormData) {
  const weekday = Number(formData.get("weekday"));
  const startTime = String(formData.get("startTime") || "");
  const endTime = String(formData.get("endTime") || "");
  const capacity = Number(formData.get("capacity"));

  if (
    !Number.isInteger(weekday) ||
    weekday < 0 ||
    weekday > 6 ||
    !startTime ||
    !endTime ||
    !Number.isInteger(capacity) ||
    capacity < 1
  ) {
    return null;
  }

  return { weekday, startTime, endTime, capacity };
}

export async function createTrialSlot(formData: FormData) {
  const fields = parseSlotFields(formData);
  if (!fields) redirect("/coach/schedule?error=invalid");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/signin");

  const { error } = await supabase.from("trial_slots").insert({
    weekday: fields.weekday,
    start_time: fields.startTime,
    end_time: fields.endTime,
    capacity: fields.capacity,
  });

  if (error) redirect("/coach/schedule?error=unknown");

  revalidatePath("/coach/schedule");
  revalidatePath("/account/trial");
  redirect("/coach/schedule?created=1");
}

export async function updateTrialSlot(formData: FormData) {
  const slotId = String(formData.get("slotId") || "");
  const fields = parseSlotFields(formData);
  const active = formData.get("active") === "on";
  if (!slotId || !fields) redirect("/coach/schedule?error=invalid");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/signin");

  const { error } = await supabase
    .from("trial_slots")
    .update({
      weekday: fields.weekday,
      start_time: fields.startTime,
      end_time: fields.endTime,
      capacity: fields.capacity,
      active,
    })
    .eq("id", slotId);

  if (error) redirect("/coach/schedule?error=unknown");

  revalidatePath("/coach/schedule");
  revalidatePath("/account/trial");
  redirect("/coach/schedule?updated=1");
}
