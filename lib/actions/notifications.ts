"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function markNotificationRead(formData: FormData) {
  const id = String(formData.get("id") || "");
  const returnTo = String(formData.get("returnTo") || "/account/notifications");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/signin");

  if (id) {
    await supabase.from("notifications").update({ read: true }).eq("id", id).eq("user_id", userData.user.id);
  }

  revalidatePath("/account/notifications");
  revalidatePath("/coach/notifications");
  redirect(returnTo);
}

export async function markAllNotificationsRead(formData: FormData) {
  const returnTo = String(formData.get("returnTo") || "/account/notifications");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/signin");

  await supabase.from("notifications").update({ read: true }).eq("user_id", userData.user.id).eq("read", false);

  revalidatePath("/account/notifications");
  revalidatePath("/coach/notifications");
  redirect(returnTo);
}
