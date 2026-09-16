import { createClient } from "@/lib/supabase/server";
import type { RidingLevel } from "@/lib/coach";

export type Plan = {
  id: string;
  level: RidingLevel;
  name: string;
  description: string | null;
  price: number;
  sessionCount: number;
  active: boolean;
};

export async function getAllPlans(): Promise<Plan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("id, level, name, description, price, session_count, active")
    .order("level", { ascending: true })
    .order("price", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    level: row.level as RidingLevel,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    sessionCount: row.session_count,
    active: row.active,
  }));
}

export async function getActivePlansForLevel(level: RidingLevel): Promise<Plan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("id, level, name, description, price, session_count, active")
    .eq("level", level)
    .eq("active", true)
    .order("price", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    level: row.level as RidingLevel,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    sessionCount: row.session_count,
    active: row.active,
  }));
}

export async function getAllActivePlans(): Promise<Plan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("id, level, name, description, price, session_count, active")
    .eq("active", true)
    .order("level", { ascending: true })
    .order("price", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    level: row.level as RidingLevel,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    sessionCount: row.session_count,
    active: row.active,
  }));
}

export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}
