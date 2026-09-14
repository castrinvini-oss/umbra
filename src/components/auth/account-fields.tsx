"use client";

import Link from "next/link";
import { MIN_AGE } from "@/lib/constants";
import { Checkbox, Field, Input } from "@/components/ui/primitives";

export type AccountDraft = {
  name: string;
  email: string;
  password: string;
  birthDate: string;
  phone: string;
  acceptTerms: boolean;
  confirmAdult: boolean;
};

export const emptyAccount: AccountDraft = { name: "", email: "", password: "", birthDate: "", phone: "", acceptTerms: false, confirmAdult: false };

/** Campos de cadastro reutilizados em /cadastro e no checkout. */
export function AccountFields({
  value,
  onChange,
  errors = {},
  prefix = "",
}: {
  value: AccountDraft;
  onChange: (v: AccountDraft) => void;
  errors?: Record<string, string>;
  prefix?: string;
}) {
  const set = <K extends keyof AccountDraft>(k: K, v: AccountDraft[K]) => onChange({ ...value, [k]: v });
  const err = (k: string) => errors[`${prefix}${k}`];
  const maxBirth = new Date(new Date().setFullYear(new Date().getFullYear() - MIN_AGE)).toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <Field label="Nome" error={err("name")}>
        <Input autoComplete="name" value={value.name} onChange={(e) => set("name", e.target.value)} invalid={!!err("name")} />
      </Field>
      <Field label="E-mail" error={err("email")}>
        <Input type="email" autoComplete="email" value={value.email} onChange={(e) => set("email", e.target.value)} invalid={!!err("email")} />
      </Field>
      <Field label="Senha" hint="Mínimo 10 caracteres, com letras e números" error={err("password")}>
        <Input type="password" autoComplete="new-password" value={value.password} onChange={(e) => set("password", e.target.value)} invalid={!!err("password")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data de nascimento" error={err("birthDate")}>
          <Input type="date" max={maxBirth} value={value.birthDate} onChange={(e) => set("birthDate", e.target.value)} invalid={!!err("birthDate")} />
        </Field>
        <Field label="Telefone (opcional)" error={err("phone")}>
          <Input type="tel" autoComplete="tel" value={value.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
      </div>
      <div className="space-y-3 pt-1">
        <Checkbox checked={value.confirmAdult} onChange={(v) => set("confirmAdult", v)} invalid={!!err("confirmAdult")}>
          Declaro que tenho <b>18 anos ou mais</b> e que o acesso a conteúdo adulto é permitido na minha localidade.
        </Checkbox>
        <Checkbox checked={value.acceptTerms} onChange={(v) => set("acceptTerms", v)} invalid={!!err("acceptTerms")}>
          Li e aceito os{" "}
          <Link href="/termos" target="_blank" className="text-primary underline-offset-2 hover:underline">
            Termos de uso
          </Link>{" "}
          e a{" "}
          <Link href="/privacidade" target="_blank" className="text-primary underline-offset-2 hover:underline">
            Política de privacidade
          </Link>
          .
        </Checkbox>
        {(err("confirmAdult") || err("acceptTerms")) && <p className="error-text">{err("confirmAdult") ?? err("acceptTerms")}</p>}
      </div>
    </div>
  );
}
