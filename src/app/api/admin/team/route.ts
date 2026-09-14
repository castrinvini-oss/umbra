import { teamMemberSchema } from "@/lib/validators";
import { db } from "@/server/db";
import { apiRoute, HttpError } from "@/server/http/api";
import { hashPassword } from "@/server/security/password";
import { listAdminLogs, listTeam } from "@/server/services/admin-queries.service";
import { logAdmin } from "@/server/services/audit.service";

export const GET = apiRoute({ auth: "team.manage" }, async () => ({ team: await listTeam(), logs: await listAdminLogs() }));

/** Cria membro da equipe (ADMIN, MODERATOR ou CREATOR). */
export const POST = apiRoute({ auth: "team.manage", schema: teamMemberSchema }, async ({ body, user, ip }) => {
  if (await db.user.findUnique({ where: { email: body.email } })) throw new HttpError(409, "E-mail já cadastrado", { email: "Já existe" });
  const member = await db.user.create({
    data: {
      name: body.name,
      email: body.email,
      role: body.role,
      passwordHash: await hashPassword(body.password),
      ageConfirmedAt: new Date(),
      termsAcceptedAt: new Date(),
    },
  });
  await logAdmin({ actorId: user.id, action: "team.create", entityType: "user", entityId: member.id, ip, metadata: { role: body.role } });
  return { ok: true };
});
