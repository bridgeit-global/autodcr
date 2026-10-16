import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INVALID_LOGIN = "Invalid username or password. Please try again.";
const LOGIN_FAILED = "An error occurred during login. Please try again.";

type LookupRow = {
  email?: string | null;
  user_id?: string | null;
  consultant_type?: string | null;
  raw_user_meta_data?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

function sessionIdFromAccessToken(token: string): string | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as {
      session_id?: unknown;
    };
    return typeof json.session_id === "string" && json.session_id ? json.session_id : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return NextResponse.json({ error: "Server misconfigured." }, { status: 500 });
  }

  let body: { username?: unknown; password?: unknown; takeover?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const takeover = body.takeover === true;
  if (!username || !password) {
    return NextResponse.json({ error: INVALID_LOGIN }, { status: 401 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const lookupClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows, error: rpcError } = await lookupClient.rpc("get_user_email_by_user_id", {
    lookup_user_id: username,
  });

  if (rpcError || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: INVALID_LOGIN }, { status: 401 });
  }

  const row = rows[0] as LookupRow;
  if (!row.email) {
    return NextResponse.json({ error: INVALID_LOGIN }, { status: 401 });
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
    email: row.email,
    password,
  });

  const session = authData.session;
  const user = authData.user;
  if (authError || !session || !user) {
    return NextResponse.json({ error: INVALID_LOGIN }, { status: 401 });
  }

  const dropNewSession = async () => {
    await authClient.auth.signOut({ scope: "local" });
  };

  const sessionId = sessionIdFromAccessToken(session.access_token);
  if (!sessionId) {
    console.error("Login failed: access token has no session_id");
    await dropNewSession();
    return NextResponse.json({ error: LOGIN_FAILED }, { status: 500 });
  }

  const { data: otherCount, error: countError } = await admin.rpc("count_other_live_sessions", {
    p_user_id: user.id,
    p_session_id: sessionId,
  });

  const others = typeof otherCount === "number" ? otherCount : Number(otherCount);
  if (countError || !Number.isFinite(others)) {
    console.error("Login failed: count_other_live_sessions", countError?.message ?? otherCount);
    await dropNewSession();
    return NextResponse.json({ error: LOGIN_FAILED }, { status: 500 });
  }

  if (others > 0 && !takeover) {
    await dropNewSession();
    return NextResponse.json({ conflict: true });
  }

  if (takeover && others > 0) {
    const { error: othersError } = await authClient.auth.signOut({ scope: "others" });
    if (othersError) {
      console.error("Login failed: sign out other sessions", othersError.message);
      await dropNewSession();
      return NextResponse.json({ error: LOGIN_FAILED }, { status: 500 });
    }
  }

  const { error: claimError } = await admin.rpc("claim_active_login", {
    p_user_id: user.id,
    p_session_id: sessionId,
  });

  if (claimError) {
    console.error("Login failed: claim_active_login", claimError.message);
    await dropNewSession();
    return NextResponse.json({ error: LOGIN_FAILED }, { status: 500 });
  }

  const jwtMeta =
    user.user_metadata && typeof user.user_metadata === "object" ? user.user_metadata : {};
  const rpcMeta =
    row.raw_user_meta_data && typeof row.raw_user_meta_data === "object"
      ? row.raw_user_meta_data
      : row.metadata && typeof row.metadata === "object"
        ? row.metadata
        : {};

  return NextResponse.json({
    conflict: false,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    user_id: user.id,
    consultant_user_id: row.user_id || username,
    consultant_type: row.consultant_type || "",
    metadata: { ...jwtMeta, ...rpcMeta },
  });
}
