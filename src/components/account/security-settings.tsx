"use client";

import { KeyRound, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Field, Input } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api-client";

export function SecuritySettings({ twoFactorEnabled }: { twoFactorEnabled: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [setup, setSetup] = useState<{ setupToken: string; secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setSavingPwd(true);
    try {
      await api("/api/account", { method: "POST", body: { currentPassword: current, newPassword: next } });
      toast.success("Senha alterada");
      setCurrent("");
      setNext("");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Erro");
    } finally {
      setSavingPwd(false);
    }
  }

  async function twoFactor(action: "begin" | "confirm" | "disable") {
    setBusy(true);
    try {
      if (action === "begin") {
        setSetup(await api("/api/account/2fa", { method: "POST", body: { action } }));
      } else {
        await api("/api/account/2fa", { method: "POST", body: action === "confirm" ? { action, setupToken: setup?.setupToken, code } : { action, code } });
        toast.success(action === "confirm" ? "2FA ativado" : "2FA desativado");
        setSetup(null);
        setCode("");
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={changePassword} className="card card-pad space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Alterar senha</h2>
        </div>
        <Field label="Senha atual">
          <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </Field>
        <Field label="Nova senha" hint="Mínimo 10 caracteres, com letras e números">
          <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
        </Field>
        <Button type="submit" loading={savingPwd}>
          Atualizar senha
        </Button>
      </form>

      <div className="card card-pad">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Verificação em duas etapas</h2>
          </div>
          <Badge tone={twoFactorEnabled ? "success" : "neutral"} dot>
            {twoFactorEnabled ? "Ativa" : "Desativada"}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-muted">Proteja sua conta exigindo um código do aplicativo autenticador (Google Authenticator, 1Password, Authy) ao entrar.</p>

        {twoFactorEnabled ? (
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <Field label="Código atual para desativar">
              <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="w-40 font-mono tracking-widest" />
            </Field>
            <Button variant="danger" onClick={() => twoFactor("disable")} loading={busy} disabled={code.length !== 6}>
              Desativar
            </Button>
          </div>
        ) : setup ? (
          <div className="mt-5 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
            <img src={setup.qr} alt="QR Code do autenticador" className="h-44 w-44 rounded-field bg-white p-2" />
            <div className="space-y-3">
              <p className="text-xs text-muted">
                Escaneie o QR Code ou digite a chave: <code className="break-all font-mono text-ink">{setup.secret}</code>
              </p>
              <Field label="Código gerado">
                <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="w-40 font-mono tracking-widest" />
              </Field>
              <Button onClick={() => twoFactor("confirm")} loading={busy} disabled={code.length !== 6}>
                Confirmar e ativar
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="mt-4" onClick={() => twoFactor("begin")} loading={busy}>
            Ativar 2FA
          </Button>
        )}
      </div>
    </div>
  );
}
