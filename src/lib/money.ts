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
  const n = parseDecimal(raw);
  return eurosToCents(n);
}

export function parseDecimal(raw: string): number {
  const normalized = raw.trim().replace(/\s/g, "").replace("€", "").replace(",", ".");
  if (normalized === "" || normalized === "." || normalized === "-") return 0;
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

export function formatEuroInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value
    .toFixed(3)
    .replace(/\.?0+$/, "")
    .replace(".", ",");
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
