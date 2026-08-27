"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiBrowser } from "@/lib/api-browser";

export function LoginForm({ authError }: { authError?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(authError ?? null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const path = mode === "register" ? "/auth/register" : "/auth/login";
      await apiBrowser(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entrar");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-muted">Correo</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-xl border border-line bg-card px-4 text-base text-ink outline-none focus:border-accent"
            placeholder="tu@correo.com"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-muted">Contraseña</span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-xl border border-line bg-card px-4 text-base text-ink outline-none focus:border-accent"
          />
        </label>
        {error ? <p className="text-sm text-scan">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="h-12 rounded-xl bg-accent text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Entrando…" : mode === "register" ? "Crear cuenta" : "Entrar"}
        </button>
      </form>
      <button
        type="button"
        className="text-sm text-muted"
        onClick={() => {
          setError(null);
          setMode(mode === "login" ? "register" : "login");
        }}
      >
        {mode === "login" ? "Crear cuenta" : "Ya tengo cuenta"}
      </button>
    </div>
  );
}
