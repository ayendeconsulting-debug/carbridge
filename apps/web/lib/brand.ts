/**
 * Single source of truth for the product brand. UI copy, email templates, and
 * buyer-facing strings read from here so a rebrand is one file.
 *
 * Deliberately NOT rebranded (invisible to users, left as internal codenames):
 * the `@carbridge/*` workspace packages, `CB_*` env keys, the repo, and the
 * Vercel project. Renaming those is a large refactor with zero user-visible
 * gain — see the rebrand decision in the session handover.
 *
 * Pure constants only (no `server-only`) so client components can import it.
 */
export const BRAND = {
  name: "Ayende Autos",
  legalName: "Ayende Autos",
  tagline: "Canadian cars, landed in Lagos",
  /** Live once the domain is registered + pointed at Vercel (OQ-8). */
  domain: "ayendeautos.ca",
  url: "https://ayendeautos.ca",
  /** Buyer-facing support address shown in email footers. */
  supportEmail: "support@ayendeautos.ca",
} as const;

export type Brand = typeof BRAND;
