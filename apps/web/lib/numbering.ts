import "server-only";
import { prisma } from "./prisma";

export type DocKind = "QUOTE" | "INVOICE";

const PREFIX: Record<DocKind, string> = {
  QUOTE: "CB-Q",
  INVOICE: "CB-INV",
};

/**
 * Next document number for a kind, e.g. "CB-Q-2026-001" / "CB-INV-2026-001".
 * Atomic upsert + increment on DocumentCounter so concurrent issues never
 * collide on the same sequence. Mirrors the proven AQI numbering pattern.
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
