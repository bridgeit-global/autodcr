import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getSupabasePublicAnonKey,
  getSupabasePublicUrl,
} from "@/app/utils/supabaseEnv";

/**
 * Refresh the Supabase auth session from cookies and return the user (if any)
 * plus a response that carries any updated Set-Cookie headers.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    getSupabasePublicUrl(),
    getSupabasePublicAnonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Important: do not add logic between createServerClient and getUser().
  // getUser() validates the JWT and refreshes cookies when needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { user, supabaseResponse };
}
