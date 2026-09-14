import { destroySession } from "@/server/auth/session";
import { apiRoute } from "@/server/http/api";

export const POST = apiRoute({ auth: "public" }, async () => {
  await destroySession();
  return { ok: true, redirect: "/" };
});
