"use client";

import { useState } from "react";
import { seedDemoTicketsAction } from "@/lib/actions";

export function SeedButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <p className="text-sm font-medium">Empezar con los tickets de hoy</p>
      <p className="mt-1 text-sm text-muted">
        Carga el DIA (2,69 €) y el Mercadona (76,12 €) para ver el mes con datos
        reales.
      </p>
      <button
        type="button"
        disabled={pending}
        className="mt-3 h-10 rounded-xl bg-accent px-4 text-sm font-medium text-white disabled:opacity-60"
        onClick={async () => {
          setPending(true);
          setError(null);
          const result = await seedDemoTicketsAction();
          if (result.error) {
            setError(result.error);
            setPending(false);
          }
        }}
      >
        {pending ? "Cargando…" : "Cargar ejemplo"}
      </button>
      {error ? <p className="mt-2 text-sm text-scan">{error}</p> : null}
    </div>
  );
}
