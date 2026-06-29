import "server-only";
import type { EmailMessage } from "./index";

const ENDPOINT = "https://api.resend.com/emails";

/**
 * Deliver one message via the Resend HTTP API (no SDK dependency — keeps the
 * package.json untouched). Throws on non-2xx; the caller (sendEmail) catches.
 */
export async function resendSend(from: string, msg: EmailMessage): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");

  const replyTo = process.env.EMAIL_REPLY_TO || undefined;
  const bcc = process.env.EMAIL_BCC || undefined;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(bcc ? { bcc: [bcc] } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${detail.slice(0, 300)}`);
  }
}
