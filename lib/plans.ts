// lib/plans.ts — single source of truth for plan limits, features, and pricing.
// Everything that enforces tier rules reads from here.

export type PlanKey = "trial" | "starter" | "growth" | "pro";

export type PlanFeature =
  | "coverageMap"
  | "aiBriefs"
  | "gapAnalysis"
  | "repScorecards"
  | "profitCalculator"
  | "advancedReporting";

export type PlanDef = {
  key: PlanKey;
  name: string;
  amount: number; // GBP / month
  trialDays: number;
  repLimit: number | null; // null = unlimited
  features: PlanFeature[];
};

// Feature bundles by tier.
const GROWTH_FEATURES: PlanFeature[] = [
  "coverageMap",
  "aiBriefs",
  "gapAnalysis",
  "repScorecards",
  "profitCalculator",
];
const PRO_FEATURES: PlanFeature[] = [...GROWTH_FEATURES, "advancedReporting"];

export const PLANS: Record<PlanKey, PlanDef> = {
  // Trial gets full access (Growth-level) so people can evaluate everything for 14 days.
  trial: { key: "trial", name: "Trial", amount: 0, trialDays: 14, repLimit: 10, features: GROWTH_FEATURES },
  starter: { key: "starter", name: "Starter", amount: 49, trialDays: 14, repLimit: 3, features: [] },
  growth: { key: "growth", name: "Growth", amount: 149, trialDays: 14, repLimit: 10, features: GROWTH_FEATURES },
  pro: { key: "pro", name: "Pro", amount: 299, trialDays: 14, repLimit: null, features: PRO_FEATURES },
};

export function getPlan(planKey: string | null | undefined): PlanDef {
  const k = (planKey || "trial").toLowerCase() as PlanKey;
  return PLANS[k] || PLANS.trial;
}

export function planHasFeature(planKey: string | null | undefined, feature: PlanFeature): boolean {
  return getPlan(planKey).features.includes(feature);
}

export function planRepLimit(planKey: string | null | undefined): number | null {
  return getPlan(planKey).repLimit;
}

// Human-readable minimum tier that unlocks a feature (for upgrade prompts).
export function minTierForFeature(feature: PlanFeature): string {
  if (PLANS.growth.features.includes(feature)) return "Growth";
  if (PLANS.pro.features.includes(feature)) return "Pro";
  return "Growth";
}
