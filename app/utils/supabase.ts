import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicAnonKey, getSupabasePublicUrl } from "./supabaseEnv";

export const supabase = createBrowserClient(
  getSupabasePublicUrl(),
  getSupabasePublicAnonKey()
);
