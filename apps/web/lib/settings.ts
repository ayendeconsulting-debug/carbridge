import "server-only";

/**
 * Official business bank instructions shown on every (manual-payment) invoice.
 * One global block sourced from env (settlement is off-platform to the official
 * business account — never a personal account). A copy is snapshotted onto each
 * Invoice.bankInstructions at issue time, so a later env change never rewrites
 * the details on invoices already sent.
 */
export interface BankInstructions {
  bankName: string;
  accountName: string;
  accountNumber: string;
  /** Optional narration/reference hint the buyer should quote on transfer. */
  referenceHint?: string;
  /** Optional free-text note (e.g. SWIFT, sort code, branch). */
  note?: string;
}

export function getBankInstructions(): BankInstructions {
  return {
    bankName: process.env.CB_BANK_NAME ?? "—",
    accountName: process.env.CB_BANK_ACCOUNT_NAME ?? "—",
    accountNumber: process.env.CB_BANK_ACCOUNT_NUMBER ?? "—",
    referenceHint: process.env.CB_BANK_REFERENCE_HINT || undefined,
    note: process.env.CB_BANK_NOTE || undefined,
  };
}

/** Default number of days until an issued invoice is due (env-configurable). */
export function invoiceDueDays(): number {
  const raw = Number(process.env.CB_INVOICE_DUE_DAYS);
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 7;
}

/**
 * Published Premium membership price (NGN), used by the self-serve /upgrade
 * flow to issue a membership invoice without an admin in the loop. `configured`
 * is false when the env value is missing/invalid, so the UI can fall back to a
 * "contact us" message rather than quote ₦0.
 */
export interface MembershipPrice {
  amountNGN: string;
  termLabel: string;
  configured: boolean;
}

export function getMembershipPrice(): MembershipPrice {
  const raw = (process.env.CB_MEMBERSHIP_PRICE_NGN ?? "").trim();
  const n = Number(raw);
  const configured = Number.isFinite(n) && n > 0;
  return {
    amountNGN: configured ? String(n) : "0",
    termLabel: (process.env.CB_MEMBERSHIP_TERM_LABEL || "per year").trim(),
    configured,
  };
}
