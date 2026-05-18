import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Paths that do NOT require authentication
const publicPaths = ["/", "/login", "/signup", "/auth/callback", "/pay", "/privacy", "/terms"];

// Paths that ALWAYS redirect to /dashboard if authenticated
const authPaths = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths (login, signup, auth callback, payment links)
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    // If user is already authenticated on auth pages, redirect to dashboard
    if (authPaths.some((p) => pathname.startsWith(p))) {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll() {
              // Not needed for read-only check
            },
          },
        }
      );

      const { data } = await supabase.auth.getUser();
      if (data.user) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
    return NextResponse.next();
  }

  // All other paths require authentication
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          // Note: response cookies are set in the response below
        },
      },
    }
  );

  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  const response = NextResponse.next();

  // Propagate refreshed session cookies from request to response
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session) {
    const requestCookies = request.cookies.getAll();
    for (const cookie of requestCookies) {
      if (cookie.name.includes("auth") || cookie.name.includes("sb-")) {
        response.cookies.set(cookie.name, cookie.value, {
          sameSite: "lax",
          secure: true,
          httpOnly: true,
        });
      }
    }
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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
