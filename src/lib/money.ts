const euro = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

export function eurosToCents(value: number): number {
  return Math.round(Number(value) * 100);
}

export function centsToEuros(cents: number): number {
  return cents / 100;
}

export function formatCents(cents: number): string {
  return euro.format(cents / 100);
}

export function parseEuroInput(raw: string): number {
  const normalized = raw.trim().replace(/\s/g, "").replace("€", "").replace(",", ".");
  const n = Number.parseFloat(normalized);
  if (!Number.isFinite(n)) return 0;
  return eurosToCents(n);
}

export function formatEuroInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export const MISMATCH_CENTS = 2;

export function linesSumCents(
  lines: Array<{ amountCents: number }>,
): number {
  return lines.reduce((sum, line) => sum + line.amountCents, 0);
}

export function isMismatch(totalCents: number, sumCents: number): boolean {
  return Math.abs(totalCents - sumCents) > MISMATCH_CENTS;
}
