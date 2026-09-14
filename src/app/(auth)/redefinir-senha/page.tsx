"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Field, Input } from "@/components/ui/primitives";
import { api } from "@/lib/api-client";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError("As senhas não coincidem");
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ redirect: string }>("/api/auth/password", { method: "PUT", body: { token, password } });
      window.location.assign(res.redirect);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="animate-fade-up">
      <h1 className="font-display text-4xl">Nova senha</h1>
      <p className="mt-2 text-sm text-muted">Todas as sessões abertas serão encerradas por segurança.</p>
      <div className="mt-8 space-y-4">
        <Field label="Nova senha" hint="Mínimo 10 caracteres, com letras e números">
          <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Field label="Confirmar senha">
          <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </Field>
        {error && <p className="error-text">{error}</p>}
        <Button type="submit" variant="glow" size="lg" className="w-full" loading={loading} disabled={!token}>
          Salvar nova senha
        </Button>
      </div>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
