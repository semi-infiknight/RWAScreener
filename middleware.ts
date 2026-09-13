import { NextRequest, NextResponse } from "next/server";

const STAGING_HOSTS = new Set([
  "staging.meteora.fyi",
  "www.staging.meteora.fyi",
]);

/**
 * staging.meteora.fyi → program screener.
 * Prod meteora.fyi stays pad-site SoT at `/`.
 */
export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase();
  if (!STAGING_HOSTS.has(host)) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // Keep staging API + static assets as-is.
  if (
    pathname.startsWith("/api/staging") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/avatars") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg"
  ) {
    return NextResponse.next();
  }

  // Root → /staging UI
  if (pathname === "/" || pathname === "") {
    const url = req.nextUrl.clone();
    url.pathname = "/staging";
    return NextResponse.rewrite(url);
  }

  // Allow explicit /staging paths
  if (pathname === "/staging" || pathname.startsWith("/staging/")) {
    return NextResponse.next();
  }

  // Block prod pad routes on staging host (avoid mixed SoT confusion).
  if (pathname.startsWith("/api/pads") || pathname.startsWith("/projects")) {
    const url = req.nextUrl.clone();
    url.pathname = "/staging";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
