import { createClient } from "@/lib/supabase/server";

export type ClassTimeSlotRow = {
  id: string;
  startTime: string;
  endTime: string;
};

export async function getClassTimeSlots(): Promise<ClassTimeSlotRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_time_slots")
    .select("id, start_time, end_time")
    .order("start_time", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    startTime: row.start_time,
    endTime: row.end_time,
  }));
}
