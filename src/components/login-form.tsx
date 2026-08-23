"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ authError }: { authError?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(authError ?? null);
  const [pending, setPending] = useState(false);

  async function signInWithPassword(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const supabase = createClient();
      const { error: signError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signError) throw signError;
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entrar");
    } finally {
      setPending(false);
    }
  }

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });
      if (otpError) throw otpError;
      setSent(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo enviar el código";
      if (/rate limit/i.test(message)) {
        setError(
          "Supabase solo deja enviar 2 correos por hora con el SMTP gratis. Espera una hora o entra con contraseña.",
        );
        setMode("password");
      } else {
        setError(message);
      }
    } finally {
      setPending(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const supabase = createClient();
      const token = code.trim();
      const emailValue = email.trim();
      const types = ["email", "magiclink", "signup"] as const;
      let verifyError: Error | null = null;
      for (const type of types) {
        const result = await supabase.auth.verifyOtp({
          email: emailValue,
          token,
          type,
        });
        if (!result.error) {
          verifyError = null;
          break;
        }
        verifyError = result.error;
      }
      if (verifyError) throw verifyError;
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código incorrecto");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {mode === "password" || !sent ? (
        <form
          onSubmit={mode === "password" ? signInWithPassword : sendCode}
          className="flex flex-col gap-4"
        >
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
          {mode === "password" ? (
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-muted">Contraseña</span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl border border-line bg-card px-4 text-base text-ink outline-none focus:border-accent"
              />
            </label>
          ) : null}
          {error ? <p className="text-sm text-scan">{error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="h-12 rounded-xl bg-accent text-sm font-medium text-white disabled:opacity-60"
          >
            {pending
              ? "Entrando…"
              : mode === "password"
                ? "Entrar"
                : "Enviar código"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Correo enviado a <span className="text-ink">{email}</span>. Si trae un
            enlace, ábrelo en este mismo navegador. Si trae un código, escríbelo
            aquí.
          </p>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-muted">Código</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="h-12 rounded-xl border border-line bg-card px-4 text-center text-lg tracking-[0.4em] text-ink outline-none focus:border-accent"
              placeholder="••••••"
            />
          </label>
          {error ? <p className="text-sm text-scan">{error}</p> : null}
          <button
            type="submit"
            disabled={pending || code.trim().length < 6}
            className="h-12 rounded-xl bg-accent text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Entrando…" : "Entrar con código"}
          </button>
        </form>
      )}

      <button
        type="button"
        className="text-sm text-muted"
        onClick={() => {
          setError(null);
          setSent(false);
          setCode("");
          setMode(mode === "password" ? "otp" : "password");
        }}
      >
        {mode === "password" ? "Usar enlace / código por correo" : "Entrar con contraseña"}
      </button>
    </div>
  );
}
