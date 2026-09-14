"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/primitives";

export function AgeGateActions({ next }: { next: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setLoading(true);
    try {
      await api("/api/age", { method: "POST", body: { confirm: true } });
      window.location.replace(next);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="mt-7 space-y-2.5">
      <Button variant="glow" size="lg" className="w-full" onClick={confirm} loading={loading}>
        Tenho 18 anos ou mais — entrar
      </Button>
      <Button variant="ghost" size="lg" className="w-full" onClick={() => window.location.replace("https://www.google.com")}>
        Sou menor de idade — sair
      </Button>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
