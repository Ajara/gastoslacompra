import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CATEGORY_LABEL } from "@/lib/categories";
import { getMembership } from "@/lib/household";
import { formatCents } from "@/lib/money";
import type { Category, ProductRow } from "@/lib/types";

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const { user, household, supabase } = await getMembership();
  if (!user) redirect("/login");
  if (!household) redirect("/hucha");

  let query = supabase
    .from("products")
    .select("*")
    .eq("household_id", household.id)
    .order("canonical_name");

  if (q.trim()) {
    query = query.ilike("canonical_name", `%${q.trim()}%`);
  }

  const { data: products } = await query.limit(80);
  const ids = (products ?? []).map((product) => product.id as string);

  const spentByProduct = new Map<string, { count: number; spent: number }>();
  if (ids.length > 0) {
    const { data: lines } = await supabase
      .from("ticket_lines")
      .select("product_id, amount_cents")
      .in("product_id", ids);
    for (const line of lines ?? []) {
      const key = line.product_id as string;
      const current = spentByProduct.get(key) ?? { count: 0, spent: 0 };
      current.count += 1;
      current.spent += line.amount_cents as number;
      spentByProduct.set(key, current);
    }
  }

  return (
    <AppShell inviteCode={household.invite_code}>
      <Link href="/" className="text-sm text-muted">
        Inicio
      </Link>
      <h1 className="mt-4 font-serif text-3xl tracking-tight">Productos</h1>
      <form className="mt-4">
        <input
          name="q"
          defaultValue={q}
          placeholder="Leche, cola, suavizante…"
          className="h-11 w-full rounded-xl border border-line bg-card px-4 text-sm outline-none focus:border-accent"
        />
      </form>
      <ul className="mt-4 flex flex-col gap-2">
        {(products as ProductRow[] | null)?.map((product) => {
          const stats = spentByProduct.get(product.id);
          return (
            <li key={product.id}>
              <Link
                href={`/producto/${product.id}`}
                className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3"
              >
                <span>
                  <span className="block text-sm font-medium">
                    {product.canonical_name}
                  </span>
                  <span className="text-xs text-muted">
                    {CATEGORY_LABEL[product.category as Category]}
                    {stats ? ` · ${stats.count} veces` : ""}
                  </span>
                </span>
                <span className="text-sm">
                  {stats ? formatCents(stats.spent) : "—"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {products?.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No hay productos con ese nombre.</p>
      ) : null}
    </AppShell>
  );
}
