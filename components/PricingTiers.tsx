"use client";

import { useState } from "react";

type Tier = {
  name: string;
  forWho: string;
  blurb: string;
  monthly: number | null; // null = custom / contact
  features: string[];
  cta: string;
  featured: boolean;
};

const TIERS: Tier[] = [
  {
    name: "Starter",
    forWho: "Up to 3 reps",
    blurb: "For small distributors getting their field team organised.",
    monthly: 49,
    features: [
      "Customers & call logging",
      "Order building with Shopify sync",
      "Core reporting",
      "Up to 3 sales reps",
    ],
    cta: "Start free trial",
    featured: false,
  },
  {
    name: "Growth",
    forWho: "Up to 10 reps",
    blurb: "For growing teams that live in the field.",
    monthly: 149,
    features: [
      "Everything in Starter",
      "Coverage map & territory view",
      "GAP analysis & rep scorecards",
      "AI call briefs & profit calculator",
      "Up to 10 sales reps",
      "Priority support",
    ],
    cta: "Start free trial",
    featured: true,
  },
  {
    name: "Pro",
    forWho: "Unlimited reps",
    blurb: "For established distributors running at scale.",
    monthly: 299,
    features: [
      "Everything in Growth",
      "Unlimited sales reps",
      "Advanced reporting",
      "Dedicated support",
    ],
    cta: "Start free trial",
    featured: false,
  },
];

export default function PricingTiers() {
  const [annual, setAnnual] = useState(false);

  // Annual = 2 months free -> monthly * 10, shown as a per-month equivalent.
  const priceFor = (monthly: number | null) => {
    if (monthly == null) return null;
    if (!annual) return { big: `£${monthly}`, unit: "/month" };
    const perMonth = Math.round((monthly * 10) / 12);
    return { big: `£${perMonth}`, unit: "/month", sub: `£${monthly * 10} billed yearly` };
  };

  return (
    <>
      <div className="lp-billing-toggle" role="group" aria-label="Billing period">
        <button
          className={`lp-toggle-opt${!annual ? " is-active" : ""}`}
          onClick={() => setAnnual(false)}
          type="button"
        >
          Monthly
        </button>
        <button
          className={`lp-toggle-opt${annual ? " is-active" : ""}`}
          onClick={() => setAnnual(true)}
          type="button"
        >
          Annual <span className="lp-toggle-save">2 months free</span>
        </button>
      </div>

      <div className="lp-tiers">
        {TIERS.map((t) => {
          const price = priceFor(t.monthly);
          return (
            <div className={`lp-tier${t.featured ? " lp-tier-featured" : ""}`} key={t.name}>
              {t.featured && <span className="lp-tier-badge">Most popular</span>}
              <h3 className="lp-tier-name">{t.name}</h3>
              <p className="lp-tier-for">{t.forWho}</p>

              <div className="lp-tier-price">
                {price ? (
                  <>
                    <span className="lp-price-big">{price.big}</span>
                    <span className="lp-price-unit">{price.unit}</span>
                    {price.sub && <span className="lp-price-sub">{price.sub}</span>}
                  </>
                ) : (
                  <span className="lp-price-big">Let's talk</span>
                )}
              </div>

              <p className="lp-tier-blurb">{t.blurb}</p>
              <ul className="lp-tier-features">
                {t.features.map((feat) => (
                  <li key={feat}>{feat}</li>
                ))}
              </ul>
              <a
                href="#"
                className={`lp-btn ${t.featured ? "lp-btn-primary" : "lp-btn-outline"} lp-tier-cta`}
              >
                {t.cta}
              </a>
            </div>
          );
        })}
      </div>
      <p className="lp-pricing-foot">All plans include a 14-day free trial. No card required to start.</p>
    </>
  );
}
