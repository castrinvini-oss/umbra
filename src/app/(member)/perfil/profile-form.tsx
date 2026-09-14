"use client";

import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Avatar, Button, Field, Input } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, ApiClientError, uploadAvatar } from "@/lib/api-client";

export function ProfileForm({ initial }: { initial: { name: string; email: string; phone: string; avatarUrl: string | null } }) {
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [avatar, setAvatar] = useState(initial.avatarUrl);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const router = useRouter();

  async function handleAvatar(file: File) {
    setUploading(true);
    try {
      if (file.size > 4 * 1024 * 1024) throw new Error("A foto deve ter até 4 MB");
      const data = await uploadAvatar(file);
      setAvatar(data.url);
      toast.success("Foto atualizada");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message || "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/account", { method: "PUT", body: { name, phone } });
      toast.success("Perfil salvo");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="card card-pad max-w-2xl space-y-6">
      <div className="flex items-center gap-5">
        <div className="relative">
          <Avatar src={avatar} name={name} size={88} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border border-line bg-surface text-ink shadow transition hover:border-primary"
            aria-label="Alterar foto"
          >
            <Camera className="h-4 w-4" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleAvatar(e.target.files[0])}
          />
        </div>
        <div>
          <p className="font-semibold">Foto de perfil</p>
          <p className="text-xs text-muted">{uploading ? "Enviando…" : "JPG, PNG ou WEBP até 4 MB"}</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome">
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Telefone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" />
        </Field>
        <Field label="E-mail" hint="Para alterar o e-mail, fale com o suporte." className="sm:col-span-2">
          <Input value={initial.email} disabled />
        </Field>
      </div>
      <Button type="submit" loading={saving}>
        Salvar alterações
      </Button>
    </form>
  );
}
