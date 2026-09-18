"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RIDING_LEVELS, formatRidingLevel } from "@/lib/coach";
import { notifyUser } from "@/lib/notifications";

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

  await notifyUser(
    supabase,
    riderId,
    "Your riding level has been set",
    `You've been placed in ${formatRidingLevel(level as (typeof RIDING_LEVELS)[number])}.`,
    "/account"
  );

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

  const { data: booking } = await supabase.from("trial_bookings").select("user_id").eq("id", bookingId).maybeSingle();

  // RLS (trial_bookings_update_coach) gates this to coach accounts only.
  const { error } = await supabase
    .from("trial_bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId);

  if (error) redirect("/coach/riders?error=unknown");

  if (booking) {
    await notifyUser(supabase, booking.user_id, "Your trial booking was cancelled", undefined, "/account/trial");
  }

  revalidatePath("/coach/riders");
  revalidatePath("/coach");
  revalidatePath("/account/trial");
  redirect("/coach/riders?cancelled=1");
}
