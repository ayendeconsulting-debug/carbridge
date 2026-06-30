import "server-only";
import { prisma } from "../prisma";
import { BRAND } from "../brand";
import { resendSend } from "./resend";
import {
  quoteEmail,
  invoiceEmail,
  receiptEmail,
  premiumGrantedEmail,
  offerAcceptedEmail,
  requestMatchedEmail,
} from "./templates";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface Bank {
  bankName: string;
  accountName: string;
  accountNumber: string;
  referenceHint?: string;
  note?: string;
}

function fromAddress(): string {
  // Defaults to the Resend onboarding domain until ayendeautos.ca is verified
  // (then flip EMAIL_FROM to e.g. "Ayende Autos <noreply@ayendeautos.ca>").
  return process.env.EMAIL_FROM || `${BRAND.name} <onboarding@resend.dev>`;
}

/** App origin used for links inside emails (account page, etc.). Set
 *  NEXT_PUBLIC_APP_URL to the clean alias (and the custom domain post-cutover);
 *  we avoid VERCEL_URL because it resolves to per-deployment preview hashes. */
function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://carbridge-web.vercel.app";
}

/**
 * The send seam - mirrors the FX / Payments / Auth dev↔real pattern. With no
 * RESEND_API_KEY we log and send nothing (local stays zero-config); with a key
 * we deliver via Resend. ALWAYS best-effort: never throws, so a mail failure
 * can never break the invoice/payment flow that triggered it.
 */
async function sendEmail(msg: EmailMessage): Promise<{ sent: boolean }> {
  try {
    if (!msg.to) return { sent: false };
    if (!process.env.RESEND_API_KEY) {
      console.info(`[email:stub] → ${msg.to} · ${msg.subject}`);
      return { sent: false };
    }
    await resendSend(fromAddress(), msg);
    return { sent: true };
  } catch (err) {
    console.error(`[email] send failed → ${msg.to} · ${msg.subject}:`, err);
    return { sent: false };
  }
}

async function buyer(
  userId: string,
): Promise<{ email: string; name: string | null } | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  return u && u.email ? { email: u.email, name: u.name } : null;
}

/* --------------------------- public send API --------------------------- */
/* Each is fully self-contained in try/catch - nothing ever escapes into the
 * caller. Callers may `await` them without risk. */

export async function sendQuoteEmail(args: {
  userId: string;
  number: string;
  vehicleName: string;
  totalNGN: string;
  totalCAD: string;
  validUntil: Date | null;
}): Promise<void> {
  try {
    const b = await buyer(args.userId);
    if (!b) return;
    const c = quoteEmail({
      name: b.name,
      number: args.number,
      vehicleName: args.vehicleName,
      totalNGN: args.totalNGN,
      totalCAD: args.totalCAD,
      validUntil: args.validUntil,
      accountUrl: `${appUrl()}/account`,
    });
    await sendEmail({ to: b.email, ...c });
  } catch (err) {
    console.error("[email] quote email failed:", err);
  }
}

export async function sendInvoiceEmail(args: {
  userId: string;
  kind: "CAR" | "MEMBERSHIP";
  number: string;
  amountNGN: string;
  dueAt: Date | null;
  bank: Bank;
  vehicleName?: string;
}): Promise<void> {
  try {
    const b = await buyer(args.userId);
    if (!b) return;
    const c = invoiceEmail({
      name: b.name,
      kind: args.kind,
      number: args.number,
      amountNGN: args.amountNGN,
      dueAt: args.dueAt,
      bank: args.bank,
      vehicleName: args.vehicleName,
      accountUrl: `${appUrl()}/account`,
    });
    await sendEmail({ to: b.email, ...c });
  } catch (err) {
    console.error("[email] invoice email failed:", err);
  }
}

export async function sendReceiptEmail(args: {
  userId: string;
  invoiceNumber: string;
  amountPaidNGN: string;
  vehicleName: string;
}): Promise<void> {
  try {
    const b = await buyer(args.userId);
    if (!b) return;
    const c = receiptEmail({
      name: b.name,
      invoiceNumber: args.invoiceNumber,
      amountPaidNGN: args.amountPaidNGN,
      vehicleName: args.vehicleName,
      accountUrl: `${appUrl()}/account`,
    });
    await sendEmail({ to: b.email, ...c });
  } catch (err) {
    console.error("[email] receipt email failed:", err);
  }
}

export async function sendPremiumGrantedEmail(args: {
  userId: string;
  expiresAt: Date | null;
}): Promise<void> {
  try {
    const b = await buyer(args.userId);
    if (!b) return;
    const c = premiumGrantedEmail({
      name: b.name,
      expiresAt: args.expiresAt,
      accountUrl: `${appUrl()}/account`,
    });
    await sendEmail({ to: b.email, ...c });
  } catch (err) {
    console.error("[email] premium-granted email failed:", err);
  }
}

export async function sendOfferAcceptedEmail(args: {
  userId: string;
  vehicleName: string;
  agreedAmount: string;
  agreedCurrency: "NGN" | "CAD";
}): Promise<void> {
  try {
    const b = await buyer(args.userId);
    if (!b) return;
    const c = offerAcceptedEmail({
      name: b.name,
      vehicleName: args.vehicleName,
      agreedAmount: args.agreedAmount,
      agreedCurrency: args.agreedCurrency,
      accountUrl: `${appUrl()}/account`,
    });
    await sendEmail({ to: b.email, ...c });
  } catch (err) {
    console.error("[email] offer-accepted email failed:", err);
  }
}

export async function sendRequestMatchedEmail(args: {
  userId: string;
  vehicleId: string;
  vehicleName: string;
  adminNote: string | null;
}): Promise<void> {
  try {
    const b = await buyer(args.userId);
    if (!b) return;
    const c = requestMatchedEmail({
      name: b.name,
      vehicleName: args.vehicleName,
      vehicleUrl: `${appUrl()}/vehicles/${args.vehicleId}`,
      adminNote: args.adminNote,
      accountUrl: `${appUrl()}/account`,
    });
    await sendEmail({ to: b.email, ...c });
  } catch (err) {
    console.error("[email] request-matched email failed:", err);
  }
}
