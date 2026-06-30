// Single source of truth for vehicle spec options (transmission, fuel, colour).
// Imported by the admin editor, the gallery filters, the detail specs grid, and
// the create/edit API validators so none of them can drift apart.
//
// Pure module - no imports - so it type-checks anywhere (client or server).

export const TRANSMISSIONS = ["AUTOMATIC", "MANUAL"] as const;
export type TransmissionValue = (typeof TRANSMISSIONS)[number];

export const FUEL_TYPES = ["PETROL", "DIESEL", "HYBRID", "ELECTRIC"] as const;
export type FuelValue = (typeof FUEL_TYPES)[number];

// Canonical colour palette (fixed dropdown). "Other" is a terminal value - no
// free-text capture - matching the agreed palette-only design.
export const COLOURS = [
  "Black",
  "White",
  "Silver",
  "Grey",
  "Blue",
  "Red",
  "Green",
  "Brown",
  "Gold",
  "Beige",
  "Other",
] as const;
export type ColourValue = (typeof COLOURS)[number];

// Display labels (stored values are SCREAMING_CASE enums; colours store as-is).
export const TRANSMISSION_LABEL: Record<string, string> = {
  AUTOMATIC: "Automatic",
  MANUAL: "Manual",
};

export const FUEL_LABEL: Record<string, string> = {
  PETROL: "Petrol",
  DIESEL: "Diesel",
  HYBRID: "Hybrid",
  ELECTRIC: "Electric",
};

// Muted swatch hexes tuned for the dark "Manifest" theme.
export const COLOUR_SWATCH: Record<string, string> = {
  Black: "#1b1f1e",
  White: "#e7eeeb",
  Silver: "#c2c8cb",
  Grey: "#6c7a77",
  Blue: "#3566a0",
  Red: "#9d3535",
  Green: "#2f6b4f",
  Brown: "#5c4334",
  Gold: "#b3923f",
  Beige: "#cbbd9a",
  Other: "#3a4a47",
};

/** Membership checks for validators (cast away the readonly literal type). */
export const isTransmission = (v: string): boolean =>
  (TRANSMISSIONS as readonly string[]).includes(v);
export const isFuelType = (v: string): boolean =>
  (FUEL_TYPES as readonly string[]).includes(v);
export const isColour = (v: string): boolean =>
  (COLOURS as readonly string[]).includes(v);

/** Display helpers - fall back to a dash when the value is null/unknown. */
export const transmissionLabel = (v: string | null): string =>
  v ? (TRANSMISSION_LABEL[v] ?? v) : "-";
export const fuelLabel = (v: string | null): string =>
  v ? (FUEL_LABEL[v] ?? v) : "-";
export const colourSwatch = (v: string | null): string =>
  v ? (COLOUR_SWATCH[v] ?? COLOUR_SWATCH.Other) : "transparent";
