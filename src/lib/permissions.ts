import type { Role } from "./constants";

// Matriz de permissões por papel. Centralizada para servidor (guards) e
// cliente (exibir/ocultar itens de menu). A autorização real é sempre no servidor.
export const PERMISSIONS = {
  "admin.access": ["ADMIN", "MODERATOR", "CREATOR"],
  "dashboard.view": ["ADMIN", "MODERATOR", "CREATOR"],
  "leads.manage": ["ADMIN"],
  "subscribers.view": ["ADMIN", "MODERATOR"],
  "subscribers.manage": ["ADMIN"],
  "content.manage": ["ADMIN", "CREATOR"],
  "moderation.manage": ["ADMIN", "MODERATOR"],
  "plans.manage": ["ADMIN"],
  "site.manage": ["ADMIN", "CREATOR"],
  "payments.view": ["ADMIN"],
  "payments.manage": ["ADMIN"],
  "reports.view": ["ADMIN"],
  "settings.manage": ["ADMIN"],
  "team.manage": ["ADMIN"],
  "logs.view": ["ADMIN"],
} satisfies Record<string, Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: string | null | undefined, permission: Permission) {
  return !!role && (PERMISSIONS[permission] as readonly string[]).includes(role);
}
