"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function bookTrialSession(formData: FormData) {
  const slotId = String(formData.get("slotId") || "");
  const date = String(formData.get("date") || "");
  if (!slotId || !date) redirect("/account/trial?error=invalid");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) redirect("/signin");

  const { data: slot } = await supabase
    .from("trial_slots")
    .select("capacity")
    .eq("id", slotId)
    .maybeSingle();
  if (!slot) redirect("/account/trial?error=invalid");

  // Re-check capacity right before booking — the page's snapshot can be stale
  // if another rider booked the same slot moments ago.
  const { count } = await supabase
    .from("trial_bookings")
    .select("*", { count: "exact", head: true })
    .eq("slot_id", slotId)
    .eq("session_date", date)
    .eq("status", "confirmed");

  if ((count ?? 0) >= slot.capacity) {
    redirect("/account/trial?error=full");
  }

  const { error } = await supabase.from("trial_bookings").insert({
    slot_id: slotId,
    user_id: user.id,
    session_date: date,
  });

  if (error) {
    redirect(error.code === "23505" ? "/account/trial?error=duplicate" : "/account/trial?error=unknown");
  }

  revalidatePath("/account/trial");
  redirect("/account/trial?booked=1");
}

export async function cancelTrialBooking(formData: FormData) {
  const bookingId = String(formData.get("bookingId") || "");
  if (!bookingId) redirect("/account/trial?error=invalid");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) redirect("/signin");

  await supabase
    .from("trial_bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId)
    .eq("user_id", user.id);

  revalidatePath("/account/trial");
  redirect("/account/trial?cancelled=1");
}
