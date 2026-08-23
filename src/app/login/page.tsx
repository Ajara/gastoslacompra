import { LoginForm } from "@/components/login-form";
import { isSupabaseConfigured } from "@/lib/config";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
        <h1 className="font-serif text-3xl">Falta configurar Supabase</h1>
        <p className="text-sm text-muted">
          Copia <code>.env.example</code> a <code>.env.local</code> y añade la URL
          y la clave anónima. Luego ejecuta el SQL de{" "}
          <code>supabase/migrations/001_init.sql</code> en el proyecto.
        </p>
      </main>
    );
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
