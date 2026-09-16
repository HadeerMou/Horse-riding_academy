import { createClient } from "@/lib/supabase/server";
import type { RidingLevel } from "@/lib/coach";

export type EnrollmentRow = {
  id: string;
  status: "pending" | "paid" | "cancelled";
  createdAt: string;
  paidAt: string | null;
  riderName: string;
  riderEmail: string;
  planName: string;
  planLevel: RidingLevel;
  price: number;
};

export async function getAllEnrollments(): Promise<EnrollmentRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enrollments")
    .select(
      "id, status, created_at, paid_at, profiles(email, full_name), plans(name, level, price)"
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).flatMap((row) => {
    const rider = row.profiles as unknown as { email: string; full_name: string | null } | null;
    const plan = row.plans as unknown as { name: string; level: RidingLevel; price: number } | null;
    if (!rider || !plan) return [];

    return [
      {
        id: row.id,
        status: row.status as EnrollmentRow["status"],
        createdAt: row.created_at,
        paidAt: row.paid_at,
        riderName: rider.full_name || rider.email,
        riderEmail: rider.email,
        planName: plan.name,
        planLevel: plan.level,
        price: Number(plan.price),
      },
    ];
  });
}
