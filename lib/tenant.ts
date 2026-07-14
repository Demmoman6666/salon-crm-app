// lib/tenant.ts
// Core multi-tenancy helpers. EVERY tenant-scoped query must be filtered
// by the companyId returned from these helpers.

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export type TenantContext = {
  companyId: string;
  companyName: string;
  plan: string;
  shopDomain: string;
  isExempt?: boolean;
  trialEndsAt?: Date | null;
};

/**
 * Resolve the current tenant from the logged-in user's session.
 * Throws if there is no session — API routes should catch and 401.
 */
export async function requireTenant(): Promise<TenantContext> {
  const me = await getCurrentUser();
  if (!me) throw new TenantError("Unauthorized", 401);

  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: {
      companyId: true,
      company: { select: { name: true, plan: true, shopDomain: true, uninstalledAt: true, isExempt: true, trialEndsAt: true } },
    },
  });
  if (!user?.companyId || !user.company) throw new TenantError("No company for user", 403);
  if (user.company.uninstalledAt) throw new TenantError("App uninstalled for this store", 403);

  return {
    companyId: user.companyId,
    companyName: user.company.name,
    plan: user.company.plan,
    shopDomain: user.company.shopDomain,
    isExempt: user.company.isExempt,
    trialEndsAt: user.company.trialEndsAt,
  };
}

/** Non-throwing variant for server components. */
export async function getTenant(): Promise<TenantContext | null> {
  try {
    return await requireTenant();
  } catch {
    return null;
  }
}

export async function getCompanyName(): Promise<string | null> {
  const t = await getTenant();
  return t?.companyName ?? null;
}

/** Resolve a company from a Shopify shop domain (webhooks, OAuth callbacks). */
export async function companyFromShopDomain(shopDomain: string) {
  const norm = shopDomain.trim().toLowerCase();
  if (!norm) return null;
  return prisma.company.findUnique({ where: { shopDomain: norm } });
}

export class TenantError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}
