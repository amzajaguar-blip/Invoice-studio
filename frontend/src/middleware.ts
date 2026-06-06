import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Paths that do NOT require authentication
const publicPaths = ["/", "/login", "/signup", "/forgot-password", "/reset-password", "/auth/callback", "/auth/confirm", "/pay", "/privacy", "/terms", "/delete-account", "/api/webhooks", "/manifest.json", "/manifest.webmanifest", "/robots.txt", "/sitemap.xml"];

// Paths that redirect to /dashboard if user is already authenticated
const authPaths = ["/login", "/signup"];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return publicPaths.some((p) => p !== "/" && pathname.startsWith(p));
}

function isAuthPath(pathname: string): boolean {
  return authPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Single response object whose cookies are mutated by Supabase via setAll().
  // This is the canonical @supabase/ssr middleware pattern.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Mirror cookies onto the request so downstream code sees them,
          // then re-create the response and forward Set-Cookie headers.
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            // IMPORTANT: preserve the options Supabase provides. Do NOT force
            // httpOnly:true (the browser client must read these cookies) and
            // do NOT force secure:true (breaks HTTP localhost development).
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // IMPORTANT: getUser() must be called to validate the JWT and refresh tokens.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  function redirectWithCookies(url: URL) {
    const redirectResponse = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return redirectResponse;
  }

  // Already authenticated user hitting /login or /signup → send to scanner.
  if (user && isAuthPath(pathname)) {
    return redirectWithCookies(new URL("/scanner", request.url));
  }

  // Public path → just return (with any refreshed cookies).
  if (isPublicPath(pathname)) {
    return response;
  }

  // Protected path without a session → redirect to /login.
  if (!user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return redirectWithCookies(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, SVGs, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json)$).*)",
  ],
};
