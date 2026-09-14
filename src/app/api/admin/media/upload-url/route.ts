import { z } from "zod";
import { apiRoute, forbidden } from "@/server/http/api";
import { can } from "@/lib/permissions";
import { RATE_RULES } from "@/server/security/rate-limit";
import { prepareUpload } from "@/server/services/media.service";

const schema = z.object({
  fileName: z.string().min(1).max(200),
  size: z.number().int().positive(),
  contentType: z.string().max(100),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
});

/**
 * Passo 1 do upload direto: devolve URL assinada do storage (Supabase/S3) para
 * o navegador enviar o arquivo sem passar pela função serverless.
 * Com STORAGE_DRIVER=local responde { mode: "proxy" } e o cliente usa /upload.
 */
export const POST = apiRoute({ auth: "user", schema, rate: ["upload", RATE_RULES.upload] }, async ({ body, user }) => {
  if (!can(user.role, "content.manage") && !can(user.role, "site.manage")) throw forbidden();
  return prepareUpload({ ...body, fileName: body.fileName.replace(/[\\/]/g, "_"), uploaderId: user.id });
});
