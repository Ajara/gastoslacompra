import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getMe } from "@/lib/api";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const me = await getMe();
  if (me.user) {
    redirect(me.household ? "/" : "/hucha");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6">
      <div>
        <p className="text-sm text-muted">Hucha de casa</p>
        <h1 className="mt-1 font-serif text-4xl tracking-tight">La compra</h1>
        <p className="mt-3 text-sm text-muted">
          Foto del ticket al salir de la tienda. Lo veis los dos.
        </p>
      </div>
      <LoginForm authError={error} />
    </main>
  );
}
