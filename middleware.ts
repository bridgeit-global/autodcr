import { NextResponse, type NextRequest } from "next/server";
import { sanitizeReturnUrl } from "@/app/utils/applicationDeepLink";
import { updateSession } from "@/app/utils/supabase/middleware";

const PROTECTED_PREFIXES = ["/userdashboard", "/dashboard"] as const;

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isAuthPage(pathname: string): boolean {
  return pathname === "/" || pathname === "/login";
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
  });
}

export async function middleware(request: NextRequest) {
  const { user, supabaseResponse } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (!user && isProtectedPath(pathname)) {
    const returnPath = sanitizeReturnUrl(`${pathname}${search}`);
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?returnUrl=${encodeURIComponent(returnPath)}`;
    const redirect = NextResponse.redirect(url);
    copyCookies(supabaseResponse, redirect);
    return redirect;
  }

  if (user && isAuthPage(pathname)) {
    const returnUrlParam = request.nextUrl.searchParams.get("returnUrl");
    const destination = sanitizeReturnUrl(returnUrlParam);
    const redirect = NextResponse.redirect(new URL(destination, request.url));
    copyCookies(supabaseResponse, redirect);
    return redirect;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all pathnames except static assets, images, and API routes.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
