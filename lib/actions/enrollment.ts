"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notifyCoaches, getRiderDisplayName } from "@/lib/notifications";

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

  const { data: plan } = await supabase.from("plans").select("name").eq("id", planId).maybeSingle();
  const riderName = await getRiderDisplayName(supabase, user.id);
  await notifyCoaches(
    supabase,
    `${riderName} enrolled`,
    `${plan?.name ?? "A plan"} — ${sessionType} — pending payment`,
    "/coach/payments"
  );

  revalidatePath("/account");
  redirect("/account?enrolled=1");
}
