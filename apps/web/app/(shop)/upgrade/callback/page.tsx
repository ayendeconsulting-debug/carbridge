import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// The old payment-callback self-activation is retired. Premium now comes only
// from an admin grant or a paid membership invoice. Anything that still lands
// here (old links/bookmarks) is sent to "My activity".
export default async function UpgradeCallbackPage() {
  redirect("/account");
}
