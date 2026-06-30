// The seed has no photos, so cards/detail render the Manifest line-art over a
// gradient - colours derived deterministically from the vehicle id so each car
// looks stable across renders.

const PALETTES: { g1: string; g2: string; art: string }[] = [
  { g1: "#16302B", g2: "#0E211E", art: "#4E8E78" },
  { g1: "#152A2E", g2: "#0E2023", art: "#5E8088" },
  { g1: "#1A2C28", g2: "#11211D", art: "#8A7A52" },
  { g1: "#16302B", g2: "#0E211E", art: "#7E8A82" },
  { g1: "#152A2E", g2: "#0E2023", art: "#6E8088" },
  { g1: "#1A2C28", g2: "#11211D", art: "#7D8055" },
];

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

export function paletteFor(seed: string) {
  return PALETTES[hash(seed) % PALETTES.length]!;
}

/** Grade chip colour, matching the mockup's grading scale. */
export function gradeColor(grade: string): string {
  const g = grade.toUpperCase();
  if (g.startsWith("A")) return g === "A" ? "#3E8E78" : "#4E8E78";
  if (g.startsWith("B")) return g === "B+" ? "#6E8A86" : "#7E8A82";
  return "#7E8A82";
}
