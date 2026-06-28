// Client-safe: NEXT_PUBLIC_* is inlined at build, so this works in both client
// components and server code. True only when a Clerk publishable key is present;
// otherwise the app runs on the dev-bypass (existing View-as / cb_admin toggles).
export const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
