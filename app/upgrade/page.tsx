import Link from "next/link";
import { getEntitlements } from "@/lib/entitlements";
import { PLANS } from "@/lib/plans";
import PlanComparison from "@/components/PlanComparison";
import "../landing.css";

export const dynamic = "force-dynamic";

export default async function UpgradePage() {
  const ent = await getEntitlements().catch(() => null);
  const expired = ent?.trialExpired;

  const tiers = [PLANS.starter, PLANS.growth, PLANS.pro];

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "32px 16px" }}>
      <div className="card" style={{ textAlign: "center", padding: 32, marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 8px" }}>
          {expired ? "Your free trial has ended" : "Choose your plan"}
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          {expired
            ? "Pick a plan to keep using FieldCRM. Your data is safe and waiting."
            : "Upgrade to unlock more reps and features."}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {tiers.map((t) => (
          <div
            key={t.key}
            className="card"
            style={{
              padding: 24,
              border: t.key === "growth" ? "2px solid #2563eb" : undefined,
            }}
          >
            <h3 style={{ margin: "0 0 4px" }}>{t.name}</h3>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em" }}>
              £{t.amount}
              <span style={{ fontSize: 15, fontWeight: 600, color: "#64748b" }}>/mo</span>
            </div>
            <p className="small muted" style={{ margin: "6px 0 16px" }}>
              {t.repLimit == null ? "Unlimited reps" : `Up to ${t.repLimit} reps`}
            </p>
            <form action="/api/billing/subscribe" method="post">
              <input type="hidden" name="plan" value={t.key} />
              <button
                type="submit"
                className={t.key === "growth" ? "primary" : "btn"}
                style={{ width: "100%" }}
              >
                Choose {t.name}
              </button>
            </form>
          </div>
        ))}
      </div>

      <p className="small muted" style={{ textAlign: "center", marginTop: 24 }}>
        Billing is handled securely through Shopify. You can change or cancel anytime.
      </p>

      <div style={{ marginTop: 40 }}>
        <h2 style={{ textAlign: "center", margin: "0 0 4px" }}>Compare plans</h2>
        <p className="muted" style={{ textAlign: "center", margin: "0 0 20px" }}>Every feature, side by side.</p>
        <PlanComparison />
      </div>
    </div>
  );
}
