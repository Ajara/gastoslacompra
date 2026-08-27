import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { formatTicketDate } from "@/lib/dates";
import { apiServer, getMe } from "@/lib/api";
import { formatCents } from "@/lib/money";
import type { TicketLineRow, TicketRow } from "@/lib/types";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await getMe();
  if (!me.user) redirect("/login");
  if (!me.household) redirect("/hucha");

  let payload: { ticket: TicketRow & { photo_url?: string | null }; lines: TicketLineRow[] };
  try {
    payload = await apiServer(`/tickets/${id}`);
  } catch {
    notFound();
  }

  const row = payload.ticket;
  const photoUrl = row.photo_url ? `/backend${row.photo_url}` : null;

  return (
    <AppShell inviteCode={me.household.invite_code}>
      <Link href="/" className="text-sm text-muted">
        Inicio
      </Link>
      <h1 className="mt-4 font-serif text-3xl tracking-tight">{row.store}</h1>
      <p className="mt-2 text-sm text-muted">{formatTicketDate(row.purchased_at)}</p>
      <p className="mt-4 font-serif text-4xl">{formatCents(row.total_cents)}</p>
      {row.payment_method ? (
        <p className="mt-1 text-sm text-muted">{row.payment_method}</p>
      ) : null}
      {row.invoice_number ? (
        <p className="text-xs text-muted">Factura {row.invoice_number}</p>
      ) : null}
      {row.mismatch ? (
        <p className="mt-3 rounded-xl bg-scan/10 px-3 py-2 text-sm text-scan">
          Las líneas no cuadraban con el total al guardar.
        </p>
      ) : null}

      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt="Foto del ticket"
          className="mt-6 w-full rounded-2xl border border-line"
        />
      ) : null}

      <h2 className="mt-8 text-sm font-medium">Líneas</h2>
      <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-card">
        {payload.lines.map((line) => (
          <li key={line.id}>
            {line.product_id ? (
              <Link
                href={`/producto/${line.product_id}`}
                className="flex items-start justify-between gap-3 px-4 py-3"
              >
                <span>
                  <span className="block text-sm">{line.raw_name}</span>
                  <span className="text-xs text-muted">
                    {line.quantity} × {formatCents(line.unit_cents)}
                    {line.note ? ` · ${line.note}` : ""}
                  </span>
                </span>
                <span className="text-sm font-medium">
                  {formatCents(line.amount_cents)}
                </span>
              </Link>
            ) : (
              <div className="flex items-start justify-between gap-3 px-4 py-3">
                <span className="text-sm">{line.raw_name}</span>
                <span className="text-sm">{formatCents(line.amount_cents)}</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
