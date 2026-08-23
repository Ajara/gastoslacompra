"use client";

import { useState } from "react";
import { createHouseholdAction, joinHouseholdAction } from "@/lib/actions";

export function HuchaForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"create" | "join" | null>(null);

  return (
    <div className="flex flex-col gap-10">
      <form
        className="flex flex-col gap-4"
        action={async (formData) => {
          setPending("create");
          setError(null);
          const result = await createHouseholdAction(formData);
          if (result?.error) {
            setError(result.error);
            setPending(null);
          }
        }}
      >
        <div>
          <h2 className="text-lg font-semibold">Crear hucha</h2>
          <p className="mt-1 text-sm text-muted">
            Si sois los primeros. Luego invitas con el código.
          </p>
        </div>
        <input
          name="name"
          required
          minLength={2}
          placeholder="Casa, la compra…"
          className="h-12 rounded-xl border border-line bg-card px-4 text-base outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending !== null}
          className="h-12 rounded-xl bg-accent text-sm font-medium text-white disabled:opacity-60"
        >
          {pending === "create" ? "Creando…" : "Crear hucha"}
        </button>
      </form>

      <div className="h-px bg-line" />

      <form
        className="flex flex-col gap-4"
        action={async (formData) => {
          setPending("join");
          setError(null);
          const result = await joinHouseholdAction(formData);
          if (result?.error) {
            setError(result.error);
            setPending(null);
          }
        }}
      >
        <div>
          <h2 className="text-lg font-semibold">Unirme con código</h2>
          <p className="mt-1 text-sm text-muted">
            Si la otra persona ya creó la hucha.
          </p>
        </div>
        <input
          name="code"
          required
          minLength={6}
          maxLength={8}
          placeholder="ABC123"
          className="h-12 rounded-xl border border-line bg-card px-4 text-center text-lg tracking-[0.3em] uppercase outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending !== null}
          className="h-12 rounded-xl border border-ink/15 bg-card text-sm font-medium disabled:opacity-60"
        >
          {pending === "join" ? "Entrando…" : "Unirme"}
        </button>
      </form>

      {error ? <p className="text-sm text-scan">{error}</p> : null}
    </div>
  );
}
