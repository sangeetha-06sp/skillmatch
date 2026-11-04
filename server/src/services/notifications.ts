import { supabase } from "../config/database";
import { throwDatabaseError } from "./database";

export async function notify(user: string, type: string, title: string, message: string, link?: string) {
  const { data, error } = await supabase.from("notifications").insert({
    user_id: user,
    type,
    title,
    message,
    link: link ?? null,
  }).select("*").single();
  if (error) throwDatabaseError(error);
  return data;
}
