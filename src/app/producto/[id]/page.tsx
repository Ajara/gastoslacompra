import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CategoryPicker } from "@/components/category-picker";
import { CATEGORY_LABEL } from "@/lib/categories";
import { formatTicketDate } from "@/lib/dates";
import { getMembership } from "@/lib/household";
import { formatCents } from "@/lib/money";
import type { Category, ProductRow, TicketLineRow } from "@/lib/types";

function PriceChart({
  points,
}: {
  points: Array<{ date: string; unitCents: number }>;
}) {
  if (points.length < 2) return null;
  const width = 320;
  const height = 120;
  const pad = 8;
  const values = points.map((point) => point.unitCents);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const coords = points.map((point, index) => {
    const x =
      pad + (index / Math.max(1, points.length - 1)) * (width - pad * 2);
    const y =
      height - pad - ((point.unitCents - min) / span) * (height - pad * 2);
    return `${x},${y}`;
  });

  return (
    <div className="mt-4">
      <p className="text-xs text-muted">Precio unitario en el tiempo (€)</p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-2 w-full rounded-2xl border border-line bg-card"
        role="img"
        aria-label="Precio unitario a lo largo del tiempo"
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          points={coords.join(" ")}
        />
      </svg>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>{formatCents(min)}</span>
        <span>{formatCents(max)}</span>
      </div>
    </div>
  );
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, household, supabase } = await getMembership();
  if (!user) redirect("/login");
  if (!household) redirect("/hucha");

  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("household_id", household.id)
    .maybeSingle();

  if (!product) notFound();
  const row = product as ProductRow;

  const { data: lines } = await supabase
    .from("ticket_lines")
    .select("*, tickets(id, store, purchased_at)")
    .eq("product_id", id)
    .eq("household_id", household.id);

  type LineWithTicket = TicketLineRow & {
    tickets: { id: string; store: string; purchased_at: string } | null;
  };

  const history = ((lines ?? []) as LineWithTicket[])
    .filter((line) => line.tickets)
    .sort(
      (a, b) =>
        new Date(a.tickets!.purchased_at).getTime() -
        new Date(b.tickets!.purchased_at).getTime(),
    );

  const spent = history.reduce((sum, line) => sum + line.amount_cents, 0);
  const last = history.at(-1);
  const first = history.at(0);
  const priceDelta =
    last && first && history.length > 1
      ? last.unit_cents - first.unit_cents
      : 0;

  return (
    <AppShell inviteCode={household.invite_code}>
      <Link href="/" className="text-sm text-muted">
        Inicio
      </Link>
      <h1 className="mt-4 font-serif text-3xl tracking-tight">
        {row.canonical_name}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {history.length} vez{history.length === 1 ? "" : "es"} · {formatCents(spent)}{" "}
        en total
      </p>

      <div className="mt-4">
        <p className="mb-2 text-xs text-muted">Categoría</p>
        <CategoryPicker productId={row.id} value={row.category} />
      </div>

      {last ? (
        <p className="mt-6 font-serif text-4xl">{formatCents(last.unit_cents)}</p>
      ) : null}
      <p className="mt-1 text-sm text-muted">
        Último precio unitario
        {priceDelta !== 0
          ? ` · ${priceDelta > 0 ? "sube" : "baja"} ${formatCents(Math.abs(priceDelta))} desde la primera vez`
          : history.length > 1
            ? " · igual que la primera vez"
            : ""}
      </p>
      <p className="text-xs text-muted">{CATEGORY_LABEL[row.category]}</p>

      <PriceChart
        points={history.map((line) => ({
          date: line.tickets!.purchased_at,
          unitCents: line.unit_cents,
        }))}
      />

      <h2 className="mt-8 text-sm font-medium">Historial</h2>
      <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-card">
        {[...history].reverse().map((line) => (
          <li key={line.id}>
            <Link
              href={`/ticket/${line.tickets!.id}`}
              className="flex items-center justify-between px-4 py-3"
            >
              <span>
                <span className="block text-sm">{line.tickets!.store}</span>
                <span className="text-xs text-muted">
                  {formatTicketDate(line.tickets!.purchased_at)} · {line.quantity} ×{" "}
                  {formatCents(line.unit_cents)}
                </span>
              </span>
              <span className="text-sm font-medium">
                {formatCents(line.amount_cents)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
