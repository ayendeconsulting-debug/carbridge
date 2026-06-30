import "server-only";
import { prisma } from "./prisma";

export type DocKind = "QUOTE" | "INVOICE";

const PREFIX: Record<DocKind, string> = {
  QUOTE: "AA-Q",
  INVOICE: "AA-INV",
};

/**
 * Next document number for a kind, e.g. "AA-Q-2026-001" / "AA-INV-2026-001".
 * Atomic upsert + increment on DocumentCounter so concurrent issues never
 * collide on the same sequence. The per-year sequence is keyed by (kind, year)
 * only - the prefix is not part of the key, so switching CB- → AA- continues
 * the existing sequence rather than resetting it.
 */
export async function nextDocumentNumber(kind: DocKind): Promise<string> {
  const year = new Date().getFullYear();
  const counter = await prisma.documentCounter.upsert({
    where: { kind_year: { kind, year } },
    create: { kind, year, seq: 1 },
    update: { seq: { increment: 1 } },
  });
  const padded = String(counter.seq).padStart(3, "0");
  return `${PREFIX[kind]}-${year}-${padded}`;
}
