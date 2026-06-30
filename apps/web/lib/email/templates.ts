import { BRAND } from "../brand";
import { fmtNGN, fmtCAD } from "../format";

/** A ready-to-send message body (provider-agnostic). */
export interface EmailContent {
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

const C = {
  bg: "#eceae3",
  card: "#ffffff",
  ink: "#1c2b2e",
  soft: "#5d6e71",
  petrol: "#0e242b",
  amber: "#f0a836",
  rule: "#e4e0d5",
  money: "#0e242b",
};

const MONO = "'Spline Sans Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
const SERIF = "Merriweather, Georgia, 'Times New Roman', serif";

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function shell(opts: { preheader: string; heading: string; body: string }): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${C.bg};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
  <tr><td style="background:${C.petrol};border-radius:8px 8px 0 0;padding:18px 24px;">
    <span style="font-family:${SERIF};font-weight:900;font-size:20px;color:${C.amber};letter-spacing:-.01em;">${esc(BRAND.name)}</span>
    <span style="font-family:${MONO};font-size:10px;letter-spacing:.22em;color:#7d9499;text-transform:uppercase;"> &nbsp;Canada &rarr; Lagos</span>
  </td></tr>
  <tr><td style="background:${C.card};padding:28px 24px 8px;border-left:1px solid ${C.rule};border-right:1px solid ${C.rule};">
    <h1 style="margin:0 0 16px;font-family:${SERIF};font-size:20px;font-weight:700;color:${C.ink};">${esc(opts.heading)}</h1>
    ${opts.body}
  </td></tr>
  <tr><td style="background:${C.card};padding:8px 24px 26px;border-left:1px solid ${C.rule};border-right:1px solid ${C.rule};border-bottom:1px solid ${C.rule};border-radius:0 0 8px 8px;">
    <hr style="border:0;border-top:1px solid ${C.rule};margin:14px 0;">
    <p style="margin:0;font-family:${SERIF};font-size:12px;line-height:1.6;color:${C.soft};">
      ${esc(BRAND.name)} &middot; ${esc(BRAND.tagline)}.<br>
      Questions? Reply to this email or contact <a href="mailto:${esc(BRAND.supportEmail)}" style="color:${C.petrol};">${esc(BRAND.supportEmail)}</a>.<br>
      FX is indicative until rate-locked. Clearing figures are from accredited agent quotations.
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function p(html: string): string {
  return `<p style="margin:0 0 14px;font-family:${SERIF};font-size:15px;line-height:1.6;color:${C.ink};">${html}</p>`;
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;font-family:${SERIF};font-size:14px;color:${C.soft};">${esc(label)}</td>
    <td style="padding:8px 0;font-family:${MONO};font-size:14px;font-weight:600;color:${C.money};text-align:right;">${esc(value)}</td>
  </tr>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 8px;"><tr>
    <td style="border-radius:6px;background:${C.amber};">
      <a href="${esc(href)}" style="display:inline-block;padding:11px 20px;font-family:${MONO};font-size:13px;font-weight:600;letter-spacing:.04em;color:#1a1205;text-decoration:none;">${esc(label)}</a>
    </td></tr></table>`;
}

function greeting(name: string | null): string {
  return p(`Hi ${name ? esc(name) : "there"},`);
}

function stepsBlock(title: string, items: string[]): string {
  const lis = items
    .map(
      (t) =>
        `<li style="margin:0 0 7px;font-family:${SERIF};font-size:14px;line-height:1.55;color:${C.ink};">${t}</li>`,
    )
    .join("");
  return `<div style="margin:2px 0 14px;">
    <div style="font-family:${MONO};font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${C.soft};margin-bottom:8px;">${esc(title)}</div>
    <ol style="margin:0;padding-left:20px;">${lis}</ol>
  </div>`;
}

/* ------------------------------- quote ------------------------------- */

export function quoteEmail(a: {
  name: string | null;
  number: string;
  vehicleName: string;
  totalNGN: string;
  totalCAD: string;
  validUntil: Date | string | null;
  accountUrl: string;
}): EmailContent {
  const body =
    greeting(a.name) +
    p(`Your quote for the <b>${esc(a.vehicleName)}</b> is ready. The landed total below is held at your locked FX rate.`) +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.rule};border-bottom:1px solid ${C.rule};margin:4px 0 16px;">
       ${row("Quote", a.number)}
       ${row("Landed total", fmtNGN(a.totalNGN))}
       ${row("Approx. CAD", fmtCAD(a.totalCAD))}
       ${a.validUntil ? row("Rate locked until", fmtDate(a.validUntil)) : ""}
     </table>` +
    stepsBlock("What happens next", [
      "Review your quote above.",
      "<b>Accept it</b> in your activity to confirm you want to proceed.",
      "We issue your invoice with bank-transfer details.",
      "Pay by transfer — we confirm and secure your vehicle.",
    ]) +
    button(a.accountUrl, "Accept & view in my activity") +
    p(`Your landed total is held at the locked rate until ${a.validUntil ? fmtDate(a.validUntil) : "the rate-lock expires"}. We can only invoice once you've accepted.`);
  return {
    subject: `Your quote ${a.number} — ${BRAND.name}`,
    html: shell({ preheader: `Quote ${a.number} for the ${a.vehicleName}`, heading: "Your quote is ready", body }),
    text: `Hi ${a.name ?? "there"},

Your quote for the ${a.vehicleName} is ready.

Quote: ${a.number}
Landed total: ${fmtNGN(a.totalNGN)} (approx. ${fmtCAD(a.totalCAD)})${a.validUntil ? `\nRate locked until: ${fmtDate(a.validUntil)}` : ``}

View it: ${a.accountUrl}

${BRAND.name} · ${BRAND.tagline}`,
  };
}

/* ------------------------------ invoice ------------------------------ */

export function invoiceEmail(a: {
  name: string | null;
  kind: "CAR" | "MEMBERSHIP";
  number: string;
  amountNGN: string;
  dueAt: Date | string | null;
  bank: Bank;
  vehicleName?: string;
  accountUrl: string;
}): EmailContent {
  const what =
    a.kind === "CAR"
      ? `the <b>${esc(a.vehicleName ?? "your vehicle")}</b>`
      : `your <b>Premium membership</b>`;
  const bankBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4ee;border:1px solid ${C.rule};border-radius:6px;margin:6px 0 16px;">
       <tr><td style="padding:14px 16px;">
         <div style="font-family:${MONO};font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${C.soft};margin-bottom:6px;">Bank transfer — official business account</div>
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
           ${row("Bank", a.bank.bankName)}
           ${row("Account name", a.bank.accountName)}
           ${row("Account number", a.bank.accountNumber)}
           ${a.bank.referenceHint ? row("Use reference", a.bank.referenceHint) : ""}
           ${a.bank.note ? row("Note", a.bank.note) : ""}
         </table>
       </td></tr>
     </table>`;
  const body =
    greeting(a.name) +
    p(`Here is your invoice for ${what}. Please pay by bank transfer to the account below and quote the reference so we can match your payment.`) +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.rule};border-bottom:1px solid ${C.rule};margin:4px 0 14px;">
       ${row("Invoice", a.number)}
       ${row("Amount due", fmtNGN(a.amountNGN))}
       ${a.dueAt ? row("Due by", fmtDate(a.dueAt)) : ""}
     </table>` +
    bankBlock +
    button(a.accountUrl, "View invoice") +
    p(
      `We confirm payment manually once the transfer lands. ${
        a.kind === "CAR"
          ? "Your reservation stays held in the meantime."
          : "Premium activates as soon as we confirm it."
      }`,
    );
  return {
    subject:
      a.kind === "CAR"
        ? `Invoice ${a.number} — ${BRAND.name}`
        : `Premium invoice ${a.number} — ${BRAND.name}`,
    html: shell({ preheader: `Invoice ${a.number} · ${fmtNGN(a.amountNGN)} due`, heading: "Your invoice", body }),
    text: `Hi ${a.name ?? "there"},

Invoice for ${a.kind === "CAR" ? a.vehicleName ?? "your vehicle" : "your Premium membership"}.

Invoice: ${a.number}
Amount due: ${fmtNGN(a.amountNGN)}${a.dueAt ? `\nDue by: ${fmtDate(a.dueAt)}` : ``}

Pay by bank transfer (official business account):
Bank: ${a.bank.bankName}
Account name: ${a.bank.accountName}
Account number: ${a.bank.accountNumber}${a.bank.referenceHint ? `\nUse reference: ${a.bank.referenceHint}` : ``}${a.bank.note ? `\nNote: ${a.bank.note}` : ``}

View it: ${a.accountUrl}

${BRAND.name} · ${BRAND.tagline}`,
  };
}

/* ------------------------------ receipt ------------------------------ */

export function receiptEmail(a: {
  name: string | null;
  invoiceNumber: string;
  amountPaidNGN: string;
  vehicleName: string;
  accountUrl: string;
}): EmailContent {
  const body =
    greeting(a.name) +
    p(`We've received your payment — thank you. Your purchase of the <b>${esc(a.vehicleName)}</b> is now confirmed.`) +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.rule};border-bottom:1px solid ${C.rule};margin:4px 0 16px;">
       ${row("Invoice", a.invoiceNumber)}
       ${row("Amount received", fmtNGN(a.amountPaidNGN))}
     </table>` +
    button(a.accountUrl, "View my activity") +
    p(`Our team will be in touch with shipping and clearing updates as your vehicle moves.`);
  return {
    subject: `Payment received — ${BRAND.name}`,
    html: shell({ preheader: `Payment received for the ${a.vehicleName}`, heading: "Payment received", body }),
    text: `Hi ${a.name ?? "there"},

We've received your payment — thank you. Your purchase of the ${a.vehicleName} is confirmed.

Invoice: ${a.invoiceNumber}
Amount received: ${fmtNGN(a.amountPaidNGN)}

View it: ${a.accountUrl}

Our team will be in touch with shipping and clearing updates.

${BRAND.name} · ${BRAND.tagline}`,
  };
}

/* -------------------------- premium granted -------------------------- */

export function premiumGrantedEmail(a: {
  name: string | null;
  expiresAt: Date | string | null;
  accountUrl: string;
}): EmailContent {
  const body =
    greeting(a.name) +
    p(`Your <b>Premium membership</b> is now active${a.expiresAt ? ` through <b>${esc(fmtDate(a.expiresAt))}</b>` : ""}.`) +
    p(`Premium unlocks Reserve, Make an Offer, and Source-a-Car across the marketplace.`) +
    button(a.accountUrl, "Start browsing");
  return {
    subject: `Premium is active — ${BRAND.name}`,
    html: shell({ preheader: `Your Premium membership is active`, heading: "Premium activated", body }),
    text: `Hi ${a.name ?? "there"},

Your Premium membership is now active${a.expiresAt ? ` through ${fmtDate(a.expiresAt)}` : ""}.

Premium unlocks Reserve, Make an Offer, and Source-a-Car.

${a.accountUrl}

${BRAND.name} · ${BRAND.tagline}`,
  };
}

/* --------------------------- offer accepted --------------------------- */

export function offerAcceptedEmail(a: {
  name: string | null;
  vehicleName: string;
  agreedAmount: string;
  agreedCurrency: "NGN" | "CAD";
  accountUrl: string;
}): EmailContent {
  const agreed = a.agreedCurrency === "NGN" ? fmtNGN(a.agreedAmount) : fmtCAD(a.agreedAmount);
  const body =
    greeting(a.name) +
    p(`Good news — your offer of <b>${esc(agreed)}</b> on the <b>${esc(a.vehicleName)}</b> was accepted.`) +
    stepsBlock("To complete your purchase", [
      "<b>Reserve</b> the vehicle at the agreed price from your activity.",
      "We issue your quote at that price — you accept it.",
      "We invoice you with bank-transfer details; you pay by transfer.",
      "We confirm the payment and your vehicle is secured.",
    ]) +
    button(a.accountUrl, "Reserve at the agreed price") +
    p(`Reserving holds the car for you. Until you reserve, it stays available to other buyers, so it's worth doing soon.`);
  return {
    subject: `Your offer was accepted — ${BRAND.name}`,
    html: shell({
      preheader: `Reserve the ${a.vehicleName} at your agreed price of ${agreed}`,
      heading: "Your offer was accepted",
      body,
    }),
    text: `Hi ${a.name ?? "there"},

Good news — your offer of ${agreed} on the ${a.vehicleName} was accepted.

To complete your purchase, reserve the vehicle at the agreed price:
${a.accountUrl}

Reserving holds the car for you. Until you reserve, it stays available to other buyers.

${BRAND.name} · ${BRAND.tagline}`,
  };
}
