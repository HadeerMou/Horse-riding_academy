import { createClient } from "@/lib/supabase/server";
import type { RidingLevel } from "@/lib/coach";

export type MyEnrollment = {
  id: string;
  status: "pending" | "paid" | "cancelled";
  planName: string;
  planLevel: RidingLevel;
  price: number;
  sessionCount: number;
};

export async function getMyEnrollment(): Promise<MyEnrollment | null> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from("enrollments")
    .select("id, status, plans(name, level, price, session_count)")
    .eq("rider_id", user.id)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const plan = data.plans as unknown as {
    name: string;
    level: RidingLevel;
    price: number;
    session_count: number;
  } | null;
  if (!plan) return null;

  return {
    id: data.id,
    status: data.status as MyEnrollment["status"],
    planName: plan.name,
    planLevel: plan.level,
    price: Number(plan.price),
    sessionCount: plan.session_count,
  };
}
