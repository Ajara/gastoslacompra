"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { EmailOtpType } from "@supabase/supabase-js";

export function AuthCallback() {
  const router = useRouter();
  const [message, setMessage] = useState("Entrando…");

  useEffect(() => {
    const run = async () => {
      const supabase = createClient();
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const type = (url.searchParams.get("type") as EmailOtpType | null) ?? "email";
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const errorDescription =
        url.searchParams.get("error_description") || hash.get("error_description");

      if (errorDescription) {
        router.replace(`/login?error=${encodeURIComponent(errorDescription)}`);
        return;
      }

      let error: { message: string } | null = null;

      if (code) {
        const result = await supabase.auth.exchangeCodeForSession(code);
        error = result.error;
      } else if (tokenHash) {
        const result = await supabase.auth.verifyOtp({
          type,
          token_hash: tokenHash,
        });
        error = result.error;
      } else if (accessToken && refreshToken) {
        const result = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        error = result.error;
      } else {
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          router.replace(
            "/login?error=" +
              encodeURIComponent(
                "El enlace no pudo iniciar sesión. Ábrelo en este mismo navegador, o usa el código de 6 dígitos.",
              ),
          );
          return;
        }
      }

      if (error) {
        setMessage(error.message);
        router.replace(`/login?error=${encodeURIComponent(error.message)}`);
        return;
      }

      router.replace("/");
      router.refresh();
    };

    void run();
  }, [router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6">
      <p className="text-sm text-muted">{message}</p>
    </main>
  );
}
