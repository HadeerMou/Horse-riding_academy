"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RIDING_LEVELS } from "@/lib/coach";

function parsePlanFields(formData: FormData) {
  const level = String(formData.get("level") || "");
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const price = Number(formData.get("price"));
  const sessionCount = Number(formData.get("sessionCount"));

  if (
    !RIDING_LEVELS.includes(level as (typeof RIDING_LEVELS)[number]) ||
    !name ||
    !Number.isFinite(price) ||
    price < 0 ||
    !Number.isInteger(sessionCount) ||
    sessionCount < 1
  ) {
    return null;
  }

  return { level, name, description: description || null, price, sessionCount };
}

export async function createPlan(formData: FormData) {
  const fields = parsePlanFields(formData);
  if (!fields) redirect("/coach/plans?error=invalid");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/signin");

  const { error } = await supabase.from("plans").insert({
    level: fields.level,
    name: fields.name,
    description: fields.description,
    price: fields.price,
    session_count: fields.sessionCount,
  });

  if (error) redirect("/coach/plans?error=unknown");

  revalidatePath("/coach/plans");
  redirect("/coach/plans?created=1");
}

export async function updatePlan(formData: FormData) {
  const planId = String(formData.get("planId") || "");
  const fields = parsePlanFields(formData);
  const active = formData.get("active") === "on";
  if (!planId || !fields) redirect("/coach/plans?error=invalid");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/signin");

  const { error } = await supabase
    .from("plans")
    .update({
      level: fields.level,
      name: fields.name,
      description: fields.description,
      price: fields.price,
      session_count: fields.sessionCount,
      active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", planId);

  if (error) redirect("/coach/plans?error=unknown");

  revalidatePath("/coach/plans");
  revalidatePath("/account");
  redirect("/coach/plans?updated=1");
}

export async function deletePlan(formData: FormData) {
  const planId = String(formData.get("planId") || "");
  if (!planId) redirect("/coach/plans?error=invalid");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/signin");

  const { error } = await supabase.from("plans").delete().eq("id", planId);

  if (error) {
    // Foreign key restriction — riders have already enrolled in this plan.
    redirect("/coach/plans?error=has-enrollments");
  }

  revalidatePath("/coach/plans");
  redirect("/coach/plans?deleted=1");
}
