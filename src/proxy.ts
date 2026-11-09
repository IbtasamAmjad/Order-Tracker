import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifySession } from "@/lib/admin-session";

// Everything under /admin, /api/admin and /live needs the admin cookie, except the login page itself.
// Masters (/m/..., /api/m/...) are not affected: they use their personal link + PIN.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  if (await verifySession(req.cookies.get(ADMIN_COOKIE)?.value, process.env.SESSION_SECRET)) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Admin login needed." }, { status: 401 });
  }
  const login = new URL("/admin/login", req.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  // /live is the live board for the office TV: it needs the admin sign-in too (the page also checks it)
  matcher: ["/admin/:path*", "/api/admin/:path*", "/live"],
};
