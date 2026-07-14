// lib/entitlements.ts — enforce plan limits at runtime.
// Exempt companies (isExempt) bypass everything.
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { getPlan, planHasFeature, planRepLimit, minTierForFeature, type PlanFeature } from "@/lib/plans";

export class UpgradeRequiredError extends Error {
  status = 402; // Payment Required
  upgradeTo: string;
  constructor(message: string, upgradeTo: string) {
    super(message);
    this.name = "UpgradeRequiredError";
    this.upgradeTo = upgradeTo;
  }
}

export type Entitlements = {
  plan: string;
  isExempt: boolean;
  trialActive: boolean;
  trialExpired: boolean;
  hasFeature: (f: PlanFeature) => boolean;
  repLimit: number | null;
};

/** Resolve the current company's entitlements from its plan + trial state. */
export async function getEntitlements(): Promise<Entitlements> {
  const t = await requireTenant();
  const isExempt = !!t.isExempt;
  const plan = t.plan || "trial";
  const onTrial = plan === "trial";
  const trialEnds = t.trialEndsAt ? new Date(t.trialEndsAt).getTime() : null;
  const trialExpired = !isExempt && onTrial && trialEnds != null && trialEnds < Date.now();
  const trialActive = onTrial && !trialExpired;

  return {
    plan,
    isExempt,
    trialActive,
    trialExpired,
    hasFeature: (f: PlanFeature) => isExempt || planHasFeature(plan, f),
    repLimit: isExempt ? null : planRepLimit(plan),
  };
}

/** Throw UpgradeRequiredError if the current plan doesn't include a feature. */
export async function requireFeature(feature: PlanFeature): Promise<void> {
  const ent = await getEntitlements();
  if (ent.isExempt) return;
  if (ent.trialExpired) {
    throw new UpgradeRequiredError("Your free trial has ended. Choose a plan to continue.", "Growth");
  }
  if (!ent.hasFeature(feature)) {
    const tier = minTierForFeature(feature);
    throw new UpgradeRequiredError(`This feature is available on the ${tier} plan and above.`, tier);
  }
}

/** Throw if trial has expired (used to gate the whole app). */
export async function requireActiveAccess(): Promise<void> {
  const ent = await getEntitlements();
  if (ent.isExempt) return;
  if (ent.trialExpired) {
    throw new UpgradeRequiredError("Your free trial has ended. Choose a plan to continue.", "Growth");
  }
}

/**
 * Check whether another sales rep can be added under the current plan.
 * Returns { ok } or { ok:false, limit, current, upgradeTo }.
 */
export async function canAddRep(): Promise<{ ok: boolean; limit: number | null; current: number; upgradeTo?: string }> {
  const t = await requireTenant();
  if (t.isExempt) return { ok: true, limit: null, current: 0 };
  const limit = planRepLimit(t.plan);
  if (limit == null) return { ok: true, limit: null, current: 0 };
  const current = await prisma.salesRep.count({ where: { companyId: t.companyId } });
  if (current >= limit) {
    const upgradeTo = t.plan === "starter" ? "Growth" : "Pro";
    return { ok: false, limit, current, upgradeTo };
  }
  return { ok: true, limit, current };
}
