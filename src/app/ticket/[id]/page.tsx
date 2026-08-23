import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { formatTicketDate } from "@/lib/dates";
import { getMembership } from "@/lib/household";
import { formatCents } from "@/lib/money";
import type { TicketLineRow, TicketRow } from "@/lib/types";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, household, supabase } = await getMembership();
  if (!user) redirect("/login");
  if (!household) redirect("/hucha");

  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", id)
    .eq("household_id", household.id)
    .maybeSingle();

  if (!ticket) notFound();
  const row = ticket as TicketRow;

  const { data: lines } = await supabase
    .from("ticket_lines")
    .select("*")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  let photoUrl: string | null = null;
  if (row.photo_path) {
    const { data } = await supabase.storage
      .from("tickets")
      .createSignedUrl(row.photo_path, 3600);
    photoUrl = data?.signedUrl ?? null;
  }

  return (
    <AppShell inviteCode={household.invite_code}>
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
        {(lines as TicketLineRow[] | null)?.map((line) => (
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
