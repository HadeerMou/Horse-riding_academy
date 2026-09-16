import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Next.js 16 renamed "middleware" to "proxy" (same mechanism — runs before
// rendering, can inspect/modify the request and response). This protects
// /account (must be signed in) and bounces signed-in visitors away from
// /signin and /register, entirely server-side — no flash of protected
// content before the redirect.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    }
  );

  // Verifies the JWT locally (or against Supabase if needed) — the current
  // recommended way to check auth state in server code, per Supabase's docs.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  const { pathname } = request.nextUrl;

  if ((pathname.startsWith("/account") || pathname.startsWith("/coach")) && !signedIn) {
    return NextResponse.redirect(new URL("/signin", request.url));
  }

  if ((pathname === "/signin" || pathname === "/register") && signedIn) {
    return NextResponse.redirect(new URL("/account", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/account/:path*", "/coach/:path*", "/signin", "/register"],
};
