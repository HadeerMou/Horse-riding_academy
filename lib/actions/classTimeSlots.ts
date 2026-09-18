"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function addClassTimeSlot(formData: FormData) {
  const startTime = String(formData.get("startTime") || "");
  const endTime = String(formData.get("endTime") || "");
  if (!startTime || !endTime) redirect("/coach/groups?error=invalid");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/signin");

  const { error } = await supabase.from("class_time_slots").insert({ start_time: startTime, end_time: endTime });
  if (error) redirect(`/coach/groups?error=${error.code === "23505" ? "duplicate-slot" : "unknown"}`);

  revalidatePath("/coach/groups");
  redirect("/coach/groups?slotAdded=1");
}

export async function removeClassTimeSlot(formData: FormData) {
  const slotId = String(formData.get("slotId") || "");
  if (!slotId) redirect("/coach/groups?error=invalid");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/signin");

  const { error } = await supabase.from("class_time_slots").delete().eq("id", slotId);
  if (error) redirect("/coach/groups?error=unknown");

  revalidatePath("/coach/groups");
  redirect("/coach/groups?slotRemoved=1");
}
