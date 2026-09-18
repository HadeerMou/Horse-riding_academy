"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notifyUser } from "@/lib/notifications";

export async function markEnrollmentPaid(formData: FormData) {
  const enrollmentId = String(formData.get("enrollmentId") || "");
  if (!enrollmentId) redirect("/coach/payments?error=invalid");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/signin");

  const { data: enrollment } = await supabase.from("enrollments").select("rider_id").eq("id", enrollmentId).maybeSingle();

  const { error } = await supabase
    .from("enrollments")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", enrollmentId);

  if (error) redirect("/coach/payments?error=unknown");

  if (enrollment) {
    await notifyUser(supabase, enrollment.rider_id, "Your enrollment is now active", "Payment received — see you in class!", "/account");
  }

  revalidatePath("/coach/payments");
  revalidatePath("/coach");
  revalidatePath("/account");
  redirect("/coach/payments?updated=1");
}

export async function cancelEnrollment(formData: FormData) {
  const enrollmentId = String(formData.get("enrollmentId") || "");
  if (!enrollmentId) redirect("/coach/payments?error=invalid");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/signin");

  const { error } = await supabase
    .from("enrollments")
    .update({ status: "cancelled" })
    .eq("id", enrollmentId);

  if (error) redirect("/coach/payments?error=unknown");

  revalidatePath("/coach/payments");
  revalidatePath("/coach");
  revalidatePath("/account");
  redirect("/coach/payments?cancelled=1");
}
