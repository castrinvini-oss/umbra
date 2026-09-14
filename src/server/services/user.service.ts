import type { RegisterInput } from "@/lib/validators";
import { db } from "../db";
import { sendEmail } from "../email";
import { env } from "../env";
import { HttpError } from "../http/api";
import { decrypt, encrypt, randomToken, sha256, signPayload, verifyPayload } from "../security/crypto";
import { burnPasswordCheck, hashPassword, verifyPassword } from "../security/password";
import { generateTotpSecret, verifyTotp } from "../security/totp";
import { destroyAllSessions } from "../auth/session";
import { logActivity } from "./audit.service";
import { advanceLead, upsertLead } from "./lead.service";
import { notifyStaff } from "./notification.service";

export async function registerUser(input: Omit<RegisterInput, "planSlug"> & { planId?: string | null }) {
  const exists = await db.user.findUnique({ where: { email: input.email } });
  if (exists) throw new HttpError(409, "Este e-mail já possui conta. Faça login.", { email: "Já cadastrado" });

  const now = new Date();
  const user = await db.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      phone: input.phone || null,
      birthDate: new Date(input.birthDate),
      ageConfirmedAt: now,
      termsAcceptedAt: now,
      role: "SUBSCRIBER",
    },
  });

  await upsertLead({ email: user.email, name: user.name, userId: user.id, phone: user.phone, source: input.source, planId: input.planId });
  if (input.planId) await advanceLead({ userId: user.id }, "INTERESTED", "Cadastro com plano selecionado", { planId: input.planId });
  await notifyStaff("NEW_SIGNUP", "Novo cadastro", `${user.name} (${user.email})`, "/admin/leads");
  await sendEmail(user.email, "welcome", { name: user.name });
  return user;
}

export type AuthResult =
  | { kind: "ok"; userId: string; role: string }
  | { kind: "2fa"; challenge: string }
  | { kind: "error"; message: string };

export async function authenticate(email: string, password: string, ip: string): Promise<AuthResult> {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    await burnPasswordCheck(password);
    return { kind: "error", message: "E-mail ou senha incorretos" };
  }
  if (!(await verifyPassword(password, user.passwordHash))) return { kind: "error", message: "E-mail ou senha incorretos" };
  if (user.status === "BLOCKED") return { kind: "error", message: "Conta bloqueada. Entre em contato com o suporte." };
  if (user.status === "SUSPENDED") return { kind: "error", message: "Conta suspensa por violação das regras." };
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    return { kind: "2fa", challenge: signPayload({ uid: user.id, purpose: "2fa" }, 300) };
  }
  await logActivity(user.id, "LOGIN", "", ip);
  return { kind: "ok", userId: user.id, role: user.role };
}

export async function completeTwoFactor(challenge: string, code: string, ip: string) {
  const data = verifyPayload<{ uid: string; purpose: string }>(challenge);
  if (!data || data.purpose !== "2fa") throw new HttpError(401, "Desafio expirado. Faça login novamente.");
  const user = await db.user.findUnique({ where: { id: data.uid } });
  const secret = decrypt(user?.twoFactorSecret);
  if (!user || !secret || user.status !== "ACTIVE" || !verifyTotp(secret, code)) throw new HttpError(401, "Código inválido");
  await logActivity(user.id, "LOGIN", "2FA", ip);
  return user;
}

// ── 2FA ──────────────────────────────────────────────────────────────────────

export async function beginTwoFactorSetup(userId: string) {
  const secret = generateTotpSecret();
  // guarda o segredo pendente assinado no próprio token (só é salvo após confirmar um código)
  return { secret, setupToken: signPayload({ uid: userId, s: encrypt(secret), purpose: "2fa-setup" }, 600) };
}

export async function confirmTwoFactorSetup(userId: string, setupToken: string, code: string) {
  const data = verifyPayload<{ uid: string; s: string; purpose: string }>(setupToken);
  const secret = decrypt(data?.s);
  if (!data || data.uid !== userId || data.purpose !== "2fa-setup" || !secret) throw new HttpError(400, "Configuração expirada, recomece.");
  if (!verifyTotp(secret, code)) throw new HttpError(400, "Código inválido", { code: "Confira o horário do seu celular" });
  await db.user.update({ where: { id: userId }, data: { twoFactorEnabled: true, twoFactorSecret: encrypt(secret) } });
}

export async function disableTwoFactor(userId: string, code: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const secret = decrypt(user.twoFactorSecret);
  if (!secret || !verifyTotp(secret, code)) throw new HttpError(400, "Código inválido");
  await db.user.update({ where: { id: userId }, data: { twoFactorEnabled: false, twoFactorSecret: null } });
}

// ── Senha ────────────────────────────────────────────────────────────────────

export async function requestPasswordReset(email: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return; // resposta idêntica para não revelar contas
  const token = randomToken(32);
  await db.passwordResetToken.create({
    data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600_000) },
  });
  await sendEmail(user.email, "passwordReset", { name: user.name, link: `${env.appUrl}/redefinir-senha?token=${token}` });
}

export async function resetPassword(token: string, password: string) {
  const row = await db.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) throw new HttpError(400, "Link inválido ou expirado");
  await db.$transaction([
    db.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(password) } }),
    db.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ]);
  await destroyAllSessions(row.userId);
}

export async function changePassword(userId: string, current: string, next: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(current, user.passwordHash))) throw new HttpError(400, "Senha atual incorreta", { currentPassword: "Incorreta" });
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
}
