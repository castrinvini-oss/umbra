"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Field, Input } from "@/components/ui/primitives";
import { api } from "@/lib/api-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ message: string }>("/api/auth/password", { method: "POST", body: { email } });
      setMessage(res.message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="animate-fade-up">
      <h1 className="font-display text-4xl">Recuperar senha</h1>
      <p className="mt-2 text-sm text-muted">Enviaremos um link para você criar uma nova senha.</p>
      {message ? (
        <p className="mt-8 rounded-field bg-success/10 px-4 py-3 text-sm text-success">{message}</p>
      ) : (
        <div className="mt-8 space-y-4">
          <Field label="E-mail">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          {error && <p className="error-text">{error}</p>}
          <Button type="submit" variant="glow" size="lg" className="w-full" loading={loading}>
            Enviar link
          </Button>
        </div>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-muted hover:text-ink">
          Voltar ao login
        </Link>
      </p>
    </form>
  );
}
