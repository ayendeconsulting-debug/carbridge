import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const CLERK_ENABLED =
  !!process.env.CLERK_SECRET_KEY && !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Browsing is public; buying/admin are gated at the action level via
// getAuthContext(). Webhooks authenticate themselves (svix / HMAC). We don't
// call auth.protect() globally — clerkMiddleware runs only so auth() context is
// available to routes and server components downstream.
const handler = clerkMiddleware(async () => {
  // No-op: gating happens in getAuthContext(), not here.
});

export default CLERK_ENABLED
  ? handler
  : function middleware() {
      return NextResponse.next();
    };

export const config = {
  matcher: [
    // Skip Next internals + static files, run everywhere else
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
