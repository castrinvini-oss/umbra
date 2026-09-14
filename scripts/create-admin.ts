/**
 * Cria (ou promove) o primeiro administrador.
 *
 *   npm run admin:create
 *   npm run admin:create -- --email voce@dominio.com --name "Seu Nome" --password "SenhaForte123"
 *
 * Sem argumentos, usa ADMIN_EMAIL / ADMIN_NAME / ADMIN_PASSWORD do .env.
 * Não apaga nenhum dado — seguro para produção.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

try {
  process.loadEnvFile(".env");
} catch {
  /* variáveis já definidas no ambiente */
}

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = (arg("email") ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const name = arg("name") ?? process.env.ADMIN_NAME ?? "Administrador";
  const password = arg("password") ?? process.env.ADMIN_PASSWORD ?? "";

  if (!email || !email.includes("@")) throw new Error("Informe --email ou ADMIN_EMAIL");
  if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error("A senha precisa ter 10+ caracteres com letras e números");
  }

  const db = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const existing = await db.user.findUnique({ where: { email } });
    const now = new Date();
    const user = existing
      ? await db.user.update({ where: { email }, data: { role: "ADMIN", status: "ACTIVE", passwordHash, name } })
      : await db.user.create({ data: { email, name, passwordHash, role: "ADMIN", ageConfirmedAt: now, termsAcceptedAt: now } });

    const profile = await db.profile.findFirst();
    if (!profile) {
      await db.profile.create({ data: { userId: user.id, displayName: name, username: email.split("@")[0]!.replace(/[^a-z0-9_.]/g, "").slice(0, 30) || "creator", bio: "" } });
    }
    await db.adminLog.create({ data: { actorId: user.id, action: existing ? "team.promote" : "team.create", entityType: "user", entityId: user.id, metadata: JSON.stringify({ via: "cli" }) } });
    console.log(`✅ Administrador ${existing ? "atualizado" : "criado"}: ${email}`);
    console.log("   Acesse /login e ative o 2FA em Configurações → Segurança.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error("✖", e.message);
  process.exit(1);
});
