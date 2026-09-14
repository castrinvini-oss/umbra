import QRCode from "qrcode";
import { z } from "zod";
import { can } from "@/lib/permissions";
import { apiRoute } from "@/server/http/api";
import { totpUri } from "@/server/security/totp";
import { logAdmin } from "@/server/services/audit.service";
import { getSiteConfig } from "@/server/services/settings.service";
import { beginTwoFactorSetup, confirmTwoFactorSetup, disableTwoFactor } from "@/server/services/user.service";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("begin") }),
  z.object({ action: z.literal("confirm"), setupToken: z.string(), code: z.string().regex(/^\d{6}$/, "6 dígitos") }),
  z.object({ action: z.literal("disable"), code: z.string().regex(/^\d{6}$/, "6 dígitos") }),
]);

/** 2FA (TOTP) opcional — recomendado para administradores. */
export const POST = apiRoute({ auth: "user", schema }, async ({ body, user, ip }) => {
  if (body.action === "begin") {
    const site = await getSiteConfig();
    const { secret, setupToken } = await beginTwoFactorSetup(user.id);
    const uri = totpUri(secret, user.email, site.identity.siteName);
    return { setupToken, secret, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
  }
  if (body.action === "confirm") {
    await confirmTwoFactorSetup(user.id, body.setupToken, body.code);
    if (can(user.role, "admin.access")) await logAdmin({ actorId: user.id, action: "security.2fa.enable", ip });
    return { ok: true };
  }
  await disableTwoFactor(user.id, body.code);
  if (can(user.role, "admin.access")) await logAdmin({ actorId: user.id, action: "security.2fa.disable", ip });
  return { ok: true };
});
