import type { Fit } from "@hoodie/types";

export interface SizeRow {
  size: string;
  /** Garment measurements in inches. */
  chest: number;
  length: number;
  sleeve: number;
}

const REGULAR: SizeRow[] = [
  { size: "XS", chest: 38, length: 26, sleeve: 32 },
  { size: "S", chest: 40, length: 27, sleeve: 33 },
  { size: "M", chest: 42, length: 28, sleeve: 34 },
  { size: "L", chest: 44, length: 29, sleeve: 35 },
  { size: "XL", chest: 46, length: 30, sleeve: 36 },
  { size: "XXL", chest: 48, length: 31, sleeve: 37 },
];

const adjust = (rows: SizeRow[], d: Partial<SizeRow>) =>
  rows.map((r) => ({
    ...r,
    chest: r.chest + (d.chest ?? 0),
    length: r.length + (d.length ?? 0),
    sleeve: r.sleeve + (d.sleeve ?? 0),
  }));

export const SIZE_CHARTS: Record<Fit, SizeRow[]> = {
  REGULAR,
  OVERSIZED: adjust(REGULAR, { chest: 6, length: 1, sleeve: -1 }),
  SLIM: adjust(REGULAR, { chest: -2 }),
};

export const FIT_LABEL: Record<Fit, string> = {
  REGULAR: "Regular fit",
  OVERSIZED: "Oversized fit",
  SLIM: "Slim fit",
};

export const FIT_DESCRIPTION: Record<Fit, string> = {
  REGULAR: "True to size, with room to layer.",
  OVERSIZED: "Cut wide and boxy with dropped shoulders. Size down for a closer fit.",
  SLIM: "Close to the body. Size up if you are between sizes.",
};

/** Room (inches) a garment should have over the body's chest for each fit. */
const EASE: Record<Fit, number> = { REGULAR: 4, OVERSIZED: 8, SLIM: 2 };

/**
 * Suggests a size from the customer's body chest measurement (inches): the
 * smallest size whose garment chest leaves the fit's intended ease.
 */
export function recommendSize(bodyChest: number, fit: Fit, available?: string[]): string | null {
  const rows = SIZE_CHARTS[fit].filter((r) => !available || available.includes(r.size));
  return rows.find((r) => r.chest >= bodyChest + EASE[fit])?.size ?? null;
}
