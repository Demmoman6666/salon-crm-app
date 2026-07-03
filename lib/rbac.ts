// lib/rbac.ts — Role-based access control
// Roles define baseline capabilities; per-user Permission overrides refine within the role.
import { getCurrentUser, type SafeUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Permission } from "@prisma/client";

export type Role = "ADMIN" | "MANAGER" | "REP" | "VIEWER";

/**
 * Capability keys used across the app. These map to the Permission enum where a
 * per-user override exists, but roles are the primary gate.
 */
export const ROLE_CAPS: Record<Role, string[]> = {
  ADMIN: [
    "settings", "users", "brands", "billing",
    "reports", "calls", "customers", "pipeline", "tools.profitCalculator", "coverage",
  ],
  MANAGER: [
    "reports", "calls", "customers", "pipeline", "tools.profitCalculator", "coverage",
  ],
  REP: [
    "reports", "calls", "customers", "tools.profitCalculator",
  ],
  VIEWER: [
    "reports",
  ],
};

/** Map a capability to the Permission enum value that can toggle it off per-user. */
const CAP_TO_PERM: Record<string, Permission | undefined> = {
  reports: "VIEW_REPORTS",
  calls: "VIEW_CALLS",
  customers: "VIEW_CUSTOMERS",
  "tools.profitCalculator": "VIEW_PROFIT_CALC",
  settings: "VIEW_SETTINGS",
};

export function isAdminRole(user: SafeUser | null | undefined): boolean {
  return !!user && user.isActive && user.role === "ADMIN";
}

/**
 * Does this user have a capability?
 * 1. Role must grant it (hard gate).
 * 2. If a per-user Permission override exists for it, that override wins (within the role).
 *    overrides is the set of GRANTED permission enums; if a mappable cap has an override
 *    system in place we treat presence as allow. Default (no override rows) = role default.
 */
export function can(
  user: (SafeUser & { overridePerms?: Permission[] }) | null | undefined,
  cap: string
): boolean {
  if (!user || !user.isActive) return false;
  const role = user.role as Role;
  const caps = ROLE_CAPS[role] || [];
  if (!caps.includes(cap)) return false; // role doesn't grant it — hard no

  // If this cap is controlled by a Permission override and the user has ANY overrides set,
  // then the cap is allowed only if its permission is in the granted set.
  const perm = CAP_TO_PERM[cap];
  const overrides = user.overridePerms;
  if (perm && Array.isArray(overrides) && overrides.length > 0) {
    return overrides.includes(perm);
  }
  // No override configured → role default (allowed, since role grants it)
  return true;
}

/** Fetch current user plus their permission override enums. */
export async function getCurrentUserWithPerms(): Promise<
  (SafeUser & { overridePerms: Permission[] }) | null
> {
  const u = await getCurrentUser();
  if (!u) return null;
  const rows = await prisma.userPermission.findMany({
    where: { userId: u.id },
    select: { perm: true },
  });
  return { ...u, overridePerms: rows.map((r) => r.perm) };
}

export class ForbiddenError extends Error {
  status = 403;
  constructor(msg = "You don't have permission to do that") {
    super(msg);
    this.name = "ForbiddenError";
  }
}

/** For API routes: throws ForbiddenError (403) if the user lacks the capability. */
export async function requireCapability(cap: string) {
  const user = await getCurrentUserWithPerms();
  if (!can(user, cap)) throw new ForbiddenError();
  return user!;
}
