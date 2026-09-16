import { createClient } from "@/lib/supabase/server";

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export type TrialSlotRow = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  capacity: number;
  active: boolean;
};

export async function getAllTrialSlots(): Promise<TrialSlotRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trial_slots")
    .select("id, weekday, start_time, end_time, capacity, active")
    .order("weekday", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    weekday: row.weekday,
    startTime: row.start_time,
    endTime: row.end_time,
    capacity: row.capacity,
    active: row.active,
  }));
}
