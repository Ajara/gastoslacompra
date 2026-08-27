import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CATEGORY_LABEL } from "@/lib/categories";
import { apiServer, getMe } from "@/lib/api";
import { formatCents } from "@/lib/money";
import type { Category } from "@/lib/types";

type ProductList = {
  products: Array<{
    id: string;
    canonical_name: string;
    category: Category;
    count: number;
    spent_cents: number;
  }>;
};

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const me = await getMe();
  if (!me.user) redirect("/login");
  if (!me.household) redirect("/hucha");

  const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  const { products } = await apiServer<ProductList>(`/products${qs}`);

  return (
    <AppShell inviteCode={me.household.invite_code}>
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
        {products.map((product) => (
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
                  {CATEGORY_LABEL[product.category]}
                  {product.count ? ` · ${product.count} veces` : ""}
                </span>
              </span>
              <span className="text-sm">
                {product.count ? formatCents(product.spent_cents) : "—"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {products.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No hay productos con ese nombre.</p>
      ) : null}
    </AppShell>
  );
}
