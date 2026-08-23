import Link from "next/link";
import { signOutAction } from "@/lib/actions";

export function AppShell({
  children,
  inviteCode,
}: {
  children: React.ReactNode;
  inviteCode?: string;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-paper text-ink">
      <header className="flex items-center justify-between px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          La compra
        </Link>
        {inviteCode ? (
          <p className="text-xs text-muted">
            Código <span className="font-medium text-ink">{inviteCode}</span>
          </p>
        ) : null}
      </header>
      <main className="flex flex-1 flex-col px-4 pb-24 pt-2">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md items-center justify-around border-t border-line bg-paper/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <Link href="/" className="px-3 py-2 text-sm">
          Inicio
        </Link>
        <Link
          href="/escanear"
          className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-scan text-sm font-medium text-white"
        >
          Foto
        </Link>
        <form action={signOutAction}>
          <button type="submit" className="px-3 py-2 text-sm text-muted">
            Salir
          </button>
        </form>
      </nav>
    </div>
  );
}
