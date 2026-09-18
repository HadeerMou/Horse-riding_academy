"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RIDING_LEVELS } from "@/lib/coach";

export async function setRiderLevel(formData: FormData) {
  const riderId = String(formData.get("riderId") || "");
  const level = String(formData.get("level") || "");

  if (!riderId || !RIDING_LEVELS.includes(level as (typeof RIDING_LEVELS)[number])) {
    redirect("/coach/riders?error=invalid");
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/signin");

  // RLS (profiles_update_coach) is the real gate here — this will silently
  // update zero rows for anyone who isn't a coach, even if this action were
  // somehow reached directly.
  const { error } = await supabase
    .from("profiles")
    .update({ riding_level: level, updated_at: new Date().toISOString() })
    .eq("id", riderId);

  if (error) redirect("/coach/riders?error=unknown");

  revalidatePath("/coach/riders");
  revalidatePath("/coach");
  revalidatePath("/account");
  redirect("/coach/riders?updated=1");
}

export async function cancelRiderBooking(formData: FormData) {
  const bookingId = String(formData.get("bookingId") || "");
  if (!bookingId) redirect("/coach/riders?error=invalid");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/signin");

  // RLS (trial_bookings_update_coach) gates this to coach accounts only.
  const { error } = await supabase
    .from("trial_bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId);

  if (error) redirect("/coach/riders?error=unknown");

  revalidatePath("/coach/riders");
  revalidatePath("/coach");
  revalidatePath("/account/trial");
  redirect("/coach/riders?cancelled=1");
}
