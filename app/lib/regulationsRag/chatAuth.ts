import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";

export async function getAuthedUserClient(req: NextRequest): Promise<
  | { ok: true; user: User; client: SupabaseClient }
  | { ok: false; response: NextResponse }
> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Supabase environment variables are missing." },
        { status: 500 }
      ),
    };
  }

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Authorization required." }, { status: 401 }),
    };
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid or expired session." }, { status: 401 }),
    };
  }

  return { ok: true, user, client };
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}
