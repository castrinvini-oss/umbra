import { cookies, headers } from "next/headers";
import { cache } from "react";
import { COOKIE } from "@/lib/constants";
import { db } from "../db";
import { env } from "../env";
import { randomToken, sha256 } from "../security/crypto";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  avatarMediaId: string | null;
  twoFactorEnabled: boolean;
};

const SESSION_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  avatarMediaId: true,
  twoFactorEnabled: true,
} as const;

export async function clientInfo() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  return { ip, userAgent: h.get("user-agent")?.slice(0, 250) ?? null };
}

export async function createSession(userId: string) {
  const token = randomToken(32);
  const { ip, userAgent } = await clientInfo();
  const expiresAt = new Date(Date.now() + env.sessionTtlDays * 86400_000);
  await db.session.create({ data: { tokenHash: sha256(token), userId, expiresAt, ip, userAgent } });
  const jar = await cookies();
  jar.set(COOKIE.session, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  // Quem entra na conta já declarou maioridade no cadastro.
  jar.set(COOKIE.age, "1", { httpOnly: false, secure: env.isProd, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  return token;
}

/** Usuário da sessão atual (memoizado por requisição). Contas bloqueadas não autenticam. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE.session)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: SESSION_SELECT } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  if (session.user.status !== "ACTIVE") return null;
  // atualiza "visto por último" no máximo a cada 5 minutos
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60_000) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return session.user;
});

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE.session)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(COOKIE.session);
}

export async function destroyAllSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}
