import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicAnonKey, getSupabasePublicUrl } from "./supabaseEnv";

export const supabase = createClient(getSupabasePublicUrl(), getSupabasePublicAnonKey());

