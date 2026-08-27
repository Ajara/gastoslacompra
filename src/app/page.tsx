import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CATEGORY_LABEL } from "@/lib/categories";
import { addMonths, currentMonthParts, formatTicketDate, monthLabel } from "@/lib/dates";
import { apiServer, getMe } from "@/lib/api";
import { formatCents } from "@/lib/money";
import type { Category } from "@/lib/types";

type Summary = {
  year: number;
  month: number;
  total_cents: number;
  prev_total_cents: number;
  tickets: Array<{
    id: string;
    store: string;
    purchased_at: string;
    total_cents: number;
    mismatch: boolean;
  }>;
  by_store: Array<{ store: string; total_cents: number }>;
  repeating: Array<{
    id: string;
    name: string;
    category: Category;
    count: number;
    spent: number;
  }>;
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const me = await getMe();
  if (!me.user) redirect("/login");
  if (!me.household) redirect("/hucha");

  const params = await searchParams;
  const now = currentMonthParts();
  const year = Number(params.y) || now.year;
  const month = Number(params.m) || now.month;
  const prev = addMonths(year, month, -1);
  const next = addMonths(year, month, 1);

  const summary = await apiServer<Summary>(`/summary?year=${year}&month=${month}`);
  const total = summary.total_cents;
  const prevTotal = summary.prev_total_cents;
  const delta = total - prevTotal;
  const monthTickets = summary.tickets ?? [];
  const canGoNext = year < now.year || (year === now.year && month < now.month);

  return (
    <AppShell inviteCode={me.household.invite_code}>
      <div className="flex items-center justify-between">
        <Link href={`/?y=${prev.year}&m=${prev.month}`} className="text-sm text-muted">
          Anterior
        </Link>
        <h1 className="text-sm font-medium">{monthLabel(year, month)}</h1>
        {canGoNext ? (
          <Link href={`/?y=${next.year}&m=${next.month}`} className="text-sm text-muted">
            Siguiente
          </Link>
        ) : (
          <span className="text-sm text-muted/40">Siguiente</span>
        )}
      </div>

      <p className="mt-6 font-serif text-5xl tracking-tight">{formatCents(total)}</p>
      <p className="mt-2 text-sm text-muted">
        {monthTickets.length === 0
          ? "Aún no hay tickets este mes"
          : `${monthTickets.length} ticket${monthTickets.length === 1 ? "" : "s"}`}
        {prevTotal > 0 || total > 0
          ? ` · ${delta === 0 ? "igual que" : delta > 0 ? `${formatCents(delta)} más que` : `${formatCents(-delta)} menos que`} el mes anterior`
          : null}
      </p>

      <form action="/producto" className="mt-6">
        <input
          name="q"
          placeholder="Buscar un producto"
          className="h-11 w-full rounded-xl border border-line bg-card px-4 text-sm outline-none focus:border-accent"
        />
      </form>

      {summary.by_store?.length ? (
        <section className="mt-8">
          <h2 className="text-sm font-medium">Por tienda</h2>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-card">
            {[...summary.by_store]
              .sort((a, b) => b.total_cents - a.total_cents)
              .map((row) => (
                <li
                  key={row.store}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <span>{row.store}</span>
                  <span className="font-medium">{formatCents(row.total_cents)}</span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {summary.repeating?.length ? (
        <section className="mt-8">
          <h2 className="text-sm font-medium">Se repite</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {summary.repeating.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/producto/${item.id}`}
                  className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3"
                >
                  <span>
                    <span className="block text-sm font-medium">{item.name}</span>
                    <span className="text-xs text-muted">
                      {item.count} veces · {CATEGORY_LABEL[item.category]}
                    </span>
                  </span>
                  <span className="text-sm">{formatCents(item.spent)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {monthTickets.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-medium">Tickets</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {monthTickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/ticket/${ticket.id}`}
                  className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3"
                >
                  <span>
                    <span className="block text-sm font-medium">{ticket.store}</span>
                    <span className="text-xs text-muted">
                      {formatTicketDate(ticket.purchased_at)}
                      {ticket.mismatch ? " · no cuadra" : ""}
                    </span>
                  </span>
                  <span className="text-sm font-medium">
                    {formatCents(ticket.total_cents)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AppShell>
  );
}
