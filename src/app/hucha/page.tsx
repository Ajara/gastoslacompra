import { redirect } from "next/navigation";
import { HuchaForm } from "@/components/hucha-form";
import { getMembership } from "@/lib/household";
import { signOutAction } from "@/lib/actions";

export default async function HuchaPage() {
  const { user, household } = await getMembership();
  if (!user) redirect("/login");
  if (household) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 px-6 pt-[max(2rem,env(safe-area-inset-top))]">
      <div>
        <h1 className="font-serif text-3xl tracking-tight">Vuestra hucha</h1>
        <p className="mt-2 text-sm text-muted">
          Una para los dos. El que crea invita con un código de 6 letras.
        </p>
      </div>
      <HuchaForm />
      <form action={signOutAction}>
        <button type="submit" className="text-sm text-muted">
          Salir
        </button>
      </form>
    </main>
  );
}
