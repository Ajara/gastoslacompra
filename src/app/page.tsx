import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SeedButton } from "@/components/seed-button";
import { CATEGORY_LABEL } from "@/lib/categories";
import { addMonths, currentMonthParts, formatTicketDate, monthLabel, monthRangeIso } from "@/lib/dates";
import { getMembership } from "@/lib/household";
import { formatCents } from "@/lib/money";
import type { Category, TicketRow } from "@/lib/types";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const { user, household, supabase } = await getMembership();
  if (!user) redirect("/login");
  if (!household) redirect("/hucha");

  const params = await searchParams;
  const now = currentMonthParts();
  const year = Number(params.y) || now.year;
  const month = Number(params.m) || now.month;
  const { start, end } = monthRangeIso(year, month);
  const prev = addMonths(year, month, -1);
  const prevRange = monthRangeIso(prev.year, prev.month);
  const next = addMonths(year, month, 1);

  const [{ data: tickets }, { data: prevTickets }] = await Promise.all([
    supabase
      .from("tickets")
      .select(
        "id, store, purchased_at, total_cents, mismatch, created_at, invoice_number",
      )
      .eq("household_id", household.id)
      .gte("purchased_at", start)
      .lt("purchased_at", end)
      .order("purchased_at", { ascending: false }),
    supabase
      .from("tickets")
      .select("total_cents")
      .eq("household_id", household.id)
      .gte("purchased_at", prevRange.start)
      .lt("purchased_at", prevRange.end),
  ]);

  const monthTickets = (tickets ?? []) as TicketRow[];
  const total = monthTickets.reduce((sum, ticket) => sum + ticket.total_cents, 0);
  const prevTotal = (prevTickets ?? []).reduce(
    (sum, ticket) => sum + (ticket.total_cents as number),
    0,
  );
  const delta = total - prevTotal;

  const byStore = new Map<string, number>();
  for (const ticket of monthTickets) {
    byStore.set(ticket.store, (byStore.get(ticket.store) ?? 0) + ticket.total_cents);
  }

  const ticketIds = monthTickets.map((ticket) => ticket.id);
  let repeating: Array<{
    id: string;
    name: string;
    category: Category;
    count: number;
    spent: number;
  }> = [];

  if (ticketIds.length > 0) {
    const { data: lines } = await supabase
      .from("ticket_lines")
      .select("product_id, amount_cents, products(id, canonical_name, category)")
      .in("ticket_id", ticketIds);

    const grouped = new Map<
      string,
      { name: string; category: Category; count: number; spent: number }
    >();
    for (const row of lines ?? []) {
      const productRel = row.products as
        | { id: string; canonical_name: string; category: Category }
        | { id: string; canonical_name: string; category: Category }[]
        | null;
      const product = Array.isArray(productRel) ? productRel[0] : productRel;
      if (!product) continue;
      const current = grouped.get(product.id) ?? {
        name: product.canonical_name,
        category: product.category,
        count: 0,
        spent: 0,
      };
      current.count += 1;
      current.spent += Number(row.amount_cents);
      grouped.set(product.id, current);
    }
    repeating = [...grouped.entries()]
      .map(([id, value]) => ({ id, ...value }))
      .filter((item) => item.count >= 2)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 6);
  }

  const canGoNext = year < now.year || (year === now.year && month < now.month);

  return (
    <AppShell inviteCode={household.invite_code}>
      <div className="flex items-center justify-between">
        <Link
          href={`/?y=${prev.year}&m=${prev.month}`}
          className="text-sm text-muted"
        >
          Anterior
        </Link>
        <h1 className="text-sm font-medium">{monthLabel(year, month)}</h1>
        {canGoNext ? (
          <Link
            href={`/?y=${next.year}&m=${next.month}`}
            className="text-sm text-muted"
          >
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

      {monthTickets.length === 0 ? (
        <div className="mt-8">
          <SeedButton />
        </div>
      ) : null}

      {byStore.size > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-medium">Por tienda</h2>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-card">
            {[...byStore.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([store, amount]) => (
                <li
                  key={store}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <span>{store}</span>
                  <span className="font-medium">{formatCents(amount)}</span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {repeating.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-medium">Se repite</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {repeating.map((item) => (
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
