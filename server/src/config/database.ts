import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

export const supabase = createClient(env.supabaseUrl || "https://placeholder.supabase.co", env.supabaseServiceRoleKey || "placeholder", {
  auth: { autoRefreshToken: false, persistSession: false },
});

let databaseReady = false;

export async function connectDatabase(): Promise<void> {
  const { data, error } = await supabase.rpc("skillbridge_schema_health_check");
  if (error) throw new Error(`Supabase connection/schema check failed: ${error.message}. Run all documented SQL migrations in order.`);
  if (data !== true) throw new Error("Supabase is reachable but its schema, RPCs, or RLS setup is incomplete. Run all documented SQL migrations in order.");
  databaseReady = true;
  console.info("Supabase PostgreSQL connected and application schema verified.");
}

export async function disconnectDatabase(): Promise<void> {
  databaseReady = false;
}

export function isDatabaseReady(): boolean {
  return databaseReady;
}
