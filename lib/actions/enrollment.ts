"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function enrollInPlan(formData: FormData) {
  const planId = String(formData.get("planId") || "");
  const sessionType = String(formData.get("sessionType") || "group");
  if (!planId || !["group", "private"].includes(sessionType)) redirect("/account?error=invalid");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) redirect("/signin");

  const { error } = await supabase.from("enrollments").insert({
    rider_id: user.id,
    plan_id: planId,
    session_type: sessionType,
  });

  if (error) redirect("/account?error=unknown");

  revalidatePath("/account");
  redirect("/account?enrolled=1");
}
