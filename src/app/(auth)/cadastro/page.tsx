"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AccountFields, emptyAccount } from "@/components/auth/account-fields";
import { Button } from "@/components/ui/primitives";
import { api, ApiClientError } from "@/lib/api-client";

function SignupForm() {
  const params = useSearchParams();
  const [account, setAccount] = useState(emptyAccount);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setError(null);
    try {
      const res = await api<{ redirect: string }>("/api/auth/register", {
        method: "POST",
        body: { ...account, planSlug: params.get("plano") ?? undefined },
      });
      window.location.assign(res.redirect);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fields ?? {});
        setError(err.message);
      }
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="animate-fade-up">
      <h1 className="font-display text-4xl">Criar conta</h1>
      <p className="mt-2 text-sm text-muted">Leva menos de um minuto. Depois é só escolher seu plano.</p>
      <div className="mt-8">
        <AccountFields value={account} onChange={setAccount} errors={errors} />
      </div>
      {error && <p className="mt-4 rounded-field bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" variant="glow" size="lg" className="mt-6 w-full" loading={loading}>
        Criar conta
      </Button>
      <p className="mt-6 text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
