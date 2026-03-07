import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Pages that require a session
  const isProtectedPage =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/settings");

  // API routes that require a session (webhooks use signature auth instead)
  const isProtectedApi =
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/auth/") &&
    !pathname.startsWith("/api/webhook/");

  if ((isProtectedPage || isProtectedApi) && !req.auth) {
    if (isProtectedApi) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
