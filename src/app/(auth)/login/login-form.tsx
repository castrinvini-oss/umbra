"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api, ApiClientError } from "@/lib/api-client";
import { Button, Field, Input } from "@/components/ui/primitives";

export function LoginForm({ next, resetDone }: { next?: string; resetDone?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const qs = next ? `?next=${encodeURIComponent(next)}` : "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = challenge
        ? await api<{ redirect: string }>(`/api/auth/2fa${qs}`, { method: "POST", body: { challenge, code } })
        : await api<{ redirect?: string; requires2fa?: boolean; challenge?: string }>(`/api/auth/login${qs}`, { method: "POST", body: { email, password } });
      if ("requires2fa" in res && res.requires2fa) {
        setChallenge(res.challenge!);
        setLoading(false);
        return;
      }
      window.location.assign(res.redirect ?? "/dashboard");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Falha ao entrar");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="animate-fade-up">
      <h1 className="font-display text-4xl">{challenge ? "Verificação em duas etapas" : "Bem-vindo de volta"}</h1>
      <p className="mt-2 text-sm text-muted">
        {challenge ? "Digite o código de 6 dígitos do seu aplicativo autenticador." : "Entre para acessar seus conteúdos exclusivos."}
      </p>
      {resetDone && !challenge && <p className="mt-4 rounded-field bg-success/10 px-3 py-2 text-sm text-success">Senha redefinida. Faça login.</p>}

      <div className="mt-8 space-y-4">
        {challenge ? (
          <Field label="Código">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="text-center font-mono text-xl tracking-[0.5em]"
              autoFocus
            />
          </Field>
        ) : (
          <>
            <Field label="E-mail">
              <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Senha">
              <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
          </>
        )}
        {error && <p className="rounded-field bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <Button type="submit" variant="glow" size="lg" className="w-full" loading={loading}>
          {challenge ? (
            <>
              <ShieldCheck className="h-4 w-4" /> Verificar
            </>
          ) : (
            "Entrar"
          )}
        </Button>
      </div>

      {!challenge && (
        <div className="mt-6 flex items-center justify-between text-sm">
          <Link href="/recuperar-senha" className="text-muted hover:text-ink">
            Esqueci a senha
          </Link>
          <Link href="/cadastro" className="font-semibold text-primary hover:underline">
            Criar conta
          </Link>
        </div>
      )}
    </form>
  );
}
