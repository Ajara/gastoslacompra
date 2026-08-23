const madridDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Madrid",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const madridDateTime = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Madrid",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function madridYmd(date = new Date()): string {
  return madridDate.format(date);
}

export function monthStart(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function addMonths(year: number, month: number, delta: number): {
  year: number;
  month: number;
} {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export function monthRangeIso(year: number, month: number): {
  start: string;
  end: string;
} {
  const start = `${monthStart(year, month)}T00:00:00+02:00`;
  const next = addMonths(year, month, 1);
  const end = `${monthStart(next.year, next.month)}T00:00:00+02:00`;
  return { start, end };
}

export function currentMonthParts(date = new Date()): {
  year: number;
  month: number;
} {
  const [year, month] = madridYmd(date).split("-").map(Number);
  return { year, month };
}

export function monthLabel(year: number, month: number): string {
  const label = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid",
  }).format(new Date(Date.UTC(year, month - 1, 15)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatTicketDate(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));
}

export function toDatetimeLocalValue(iso: string): string {
  const formatted = madridDateTime.format(new Date(iso));
  return formatted.replace(" ", "T");
}

export function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}
