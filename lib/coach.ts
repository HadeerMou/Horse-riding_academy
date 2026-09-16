import { createClient } from "@/lib/supabase/server";

export const RIDING_LEVELS = ["foundation", "progression", "performance", "elite"] as const;
export type RidingLevel = (typeof RIDING_LEVELS)[number];

type BookingRow = {
  id: string;
  session_date: string;
  status: string;
  trial_slots: { start_time: string; end_time: string } | null;
};

export type RiderRow = {
  riderId: string;
  riderName: string;
  riderEmail: string;
  ridingLevel: RidingLevel | null;
  booking: {
    id: string;
    sessionDate: string;
    startTime: string;
    endTime: string;
    isUpcoming: boolean;
  } | null;
};

export async function isCoach(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_coach");
  return data === true;
}

function pickRelevantBooking(bookings: BookingRow[]): RiderRow["booking"] {
  const today = new Date().toISOString().slice(0, 10);
  const confirmed = bookings.filter((b) => b.status === "confirmed" && b.trial_slots);

  const upcoming = confirmed
    .filter((b) => b.session_date >= today)
    .sort((a, b) => a.session_date.localeCompare(b.session_date))[0];
  const chosen = upcoming ?? confirmed.sort((a, b) => b.session_date.localeCompare(a.session_date))[0];
  if (!chosen || !chosen.trial_slots) return null;

  return {
    id: chosen.id,
    sessionDate: chosen.session_date,
    startTime: chosen.trial_slots.start_time,
    endTime: chosen.trial_slots.end_time,
    isUpcoming: chosen.session_date >= today,
  };
}

export async function getAllRiders(search?: string): Promise<RiderRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, email, full_name, riding_level, trial_bookings(id, session_date, status, trial_slots(start_time, end_time))")
    .order("email", { ascending: true });

  if (search) {
    const term = `%${search}%`;
    query = query.or(`email.ilike.${term},full_name.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => ({
    riderId: row.id,
    riderName: row.full_name || row.email,
    riderEmail: row.email,
    ridingLevel: row.riding_level as RidingLevel | null,
    booking: pickRelevantBooking((row.trial_bookings ?? []) as unknown as BookingRow[]),
  }));
}

export function formatRidingLevel(level: RidingLevel | null): string {
  if (!level) return "Not yet assigned";
  return level.charAt(0).toUpperCase() + level.slice(1);
}
