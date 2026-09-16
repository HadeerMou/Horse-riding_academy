import { createClient } from "@/lib/supabase/server";

const WEEKS_AHEAD = 3;
const MIN_NOTICE_HOURS = 24;

export type TrialSlotOption = {
  slotId: string;
  date: string; // yyyy-mm-dd
  startTime: string; // HH:mm:ss
  endTime: string;
  capacity: number;
  spotsLeft: number;
};

export type TrialBooking = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
};

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function nextWeekdayOccurrence(weekday: number, weeksFromNow: number): Date {
  const result = new Date();
  result.setHours(0, 0, 0, 0);
  const diff = (weekday - result.getDay() + 7) % 7;
  result.setDate(result.getDate() + diff + weeksFromNow * 7);
  return result;
}

export async function getUpcomingTrialSlots(): Promise<TrialSlotOption[]> {
  const supabase = await createClient();

  const { data: slots, error: slotsError } = await supabase
    .from("trial_slots")
    .select("id, weekday, start_time, end_time, capacity")
    .eq("active", true);
  if (slotsError) throw slotsError;
  if (!slots || slots.length === 0) return [];

  const cutoff = new Date(Date.now() + MIN_NOTICE_HOURS * 60 * 60 * 1000);

  const occurrences = slots.flatMap((slot) => {
    const rows = [];
    for (let week = 0; week < WEEKS_AHEAD; week++) {
      const date = nextWeekdayOccurrence(slot.weekday, week);
      const [hours, minutes] = slot.start_time.split(":").map(Number);
      const dateTime = new Date(date);
      dateTime.setHours(hours, minutes, 0, 0);
      if (dateTime < cutoff) continue;
      rows.push({
        slotId: slot.id as string,
        date,
        startTime: slot.start_time as string,
        endTime: slot.end_time as string,
        capacity: slot.capacity as number,
      });
    }
    return rows;
  });

  occurrences.sort((a, b) => a.date.getTime() - b.date.getTime());
  if (occurrences.length === 0) return [];

  const { data: bookings, error: bookingsError } = await supabase
    .from("trial_bookings")
    .select("slot_id, session_date")
    .eq("status", "confirmed")
    .in("slot_id", [...new Set(occurrences.map((o) => o.slotId))]);
  if (bookingsError) throw bookingsError;

  const bookedCounts = new Map<string, number>();
  for (const booking of bookings ?? []) {
    const key = `${booking.slot_id}_${booking.session_date}`;
    bookedCounts.set(key, (bookedCounts.get(key) ?? 0) + 1);
  }

  return occurrences.map((o) => {
    const dateStr = toDateString(o.date);
    const bookedCount = bookedCounts.get(`${o.slotId}_${dateStr}`) ?? 0;
    return {
      slotId: o.slotId,
      date: dateStr,
      startTime: o.startTime,
      endTime: o.endTime,
      capacity: o.capacity,
      spotsLeft: Math.max(0, o.capacity - bookedCount),
    };
  });
}

export async function getUserTrialBooking(): Promise<TrialBooking | null> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from("trial_bookings")
    .select("id, session_date, trial_slots(start_time, end_time)")
    .eq("user_id", user.id)
    .eq("status", "confirmed")
    .gte("session_date", toDateString(new Date()))
    .order("session_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const slot = data.trial_slots as unknown as { start_time: string; end_time: string } | null;
  if (!slot) return null;

  return {
    id: data.id,
    date: data.session_date,
    startTime: slot.start_time,
    endTime: slot.end_time,
  };
}

function formatTime(time: string): string {
  const [hoursStr, minutes] = time.split(":");
  const hours = Number(hoursStr);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHours}:${minutes} ${period}`;
}

export function formatSlotLabel(slot: { date: string; startTime: string; endTime: string }): string {
  const date = new Date(`${slot.date}T00:00:00`);
  const dateLabel = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return `${dateLabel} · ${formatTime(slot.startTime)}–${formatTime(slot.endTime)}`;
}
