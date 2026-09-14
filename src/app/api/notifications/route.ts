import { can } from "@/lib/permissions";
import { apiRoute } from "@/server/http/api";
import { listNotifications, markAllRead } from "@/server/services/notification.service";

export const GET = apiRoute({ auth: "user" }, async ({ user, req }) => {
  const staff = can(user.role, "admin.access") && req.nextUrl.searchParams.get("scope") !== "me";
  return listNotifications({ staff, userId: user.id });
});

export const POST = apiRoute({ auth: "user" }, async ({ user, req }) => {
  const staff = can(user.role, "admin.access") && req.nextUrl.searchParams.get("scope") !== "me";
  await markAllRead({ staff, userId: user.id });
  return { ok: true };
});
