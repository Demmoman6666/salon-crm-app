import type { Metadata } from "next";
import Link from "next/link";
import "./landing.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "FieldCRM — Field sales CRM for B2B distributors on Shopify",
  description:
    "Turn your Shopify store into a field sales machine. Log calls, manage customers, build orders on the road, and see your reps' coverage — built for B2B distributors.",
};

export default async function LandingPage() {
  // No auto-redirect here — a stale/legacy cookie could otherwise bounce visitors
  // into a login loop. Logged-in users can click "Log in" to enter the app.

  const features = [
    { title: "Log calls from the field", body: "Reps capture every visit and call with GPS, outcome, and follow-up — from their phone, in seconds." },
    { title: "Build orders on the road", body: "Create draft orders against real Shopify stock, set payment terms, and take payment or send an invoice." },
    { title: "See your coverage", body: "A live map of where your reps have been, colour-coded by call type. Spot gaps before they cost you." },
    { title: "Know who's buying what", body: "GAP analysis by brand and product shows which customers are ordering — and who's slipping away." },
    { title: "Brief reps before every call", body: "AI-generated call briefs pull the customer's history so reps walk in ready." },
    { title: "One source of truth", body: "Customers, orders, and reps sync from Shopify automatically. No double entry, no stale spreadsheets." },
  ];

  const tiers = [
    { name: "Starter", forWho: "Up to 3 reps", blurb: "For small distributors getting their field team organised.",
      features: ["Customers & call logging", "Order building with Shopify sync", "Core reporting", "Up to 3 sales reps"], cta: "Start free trial", featured: false },
    { name: "Growth", forWho: "Up to 10 reps", blurb: "For growing teams that live in the field.",
      features: ["Everything in Starter", "Coverage map & territory view", "GAP analysis & rep scorecards", "AI call briefs & profit calculator", "Up to 10 sales reps", "Priority support"], cta: "Start free trial", featured: true },
    { name: "Pro", forWho: "Unlimited reps", blurb: "For established distributors running at scale.",
      features: ["Everything in Growth", "Unlimited sales reps", "Advanced reporting", "Dedicated support"], cta: "Talk to us", featured: false },
  ];

  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-container lp-nav-inner">
          <span className="lp-wordmark">Field<span>CRM</span></span>
          <nav className="lp-nav-links">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <Link href="/login" className="lp-link-login">Log in</Link>
          </nav>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-grid-bg" aria-hidden />
        <div className="lp-container lp-hero-inner">
          <p className="lp-eyebrow">Field sales CRM · Built for Shopify</p>
          <h1 className="lp-hero-title">
            Your reps are in the field.<br />
            <span className="lp-accent">Your CRM should be too.</span>
          </h1>
          <p className="lp-hero-sub">
            FieldCRM turns your Shopify store into a field-sales machine. Log every call,
            build orders against live stock, and see exactly where your team has been —
            purpose-built for B2B distributors.
          </p>
          <div className="lp-hero-cta">
            <a href="#pricing" className="lp-btn lp-btn-primary">Start free trial</a>
            <Link href="/login" className="lp-btn lp-btn-ghost">Log in</Link>
          </div>
          <p className="lp-hero-note">14-day free trial · Installs from your Shopify admin</p>
        </div>
      </section>

      <section className="lp-section" id="features">
        <div className="lp-container">
          <p className="lp-section-eyebrow">What it does</p>
          <h2 className="lp-section-title">Everything a field team needs, in one place</h2>
          <div className="lp-features">
            {features.map((f) => (
              <div className="lp-feature" key={f.title}>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-pricing-section" id="pricing">
        <div className="lp-container">
          <p className="lp-section-eyebrow">Pricing</p>
          <h2 className="lp-section-title">Priced by the size of your team</h2>
          <p className="lp-section-lead">Every plan includes the core CRM. Choose the tier that fits how many reps you run.</p>
          <div className="lp-tiers">
            {tiers.map((t) => (
              <div className={`lp-tier${t.featured ? " lp-tier-featured" : ""}`} key={t.name}>
                {t.featured && <span className="lp-tier-badge">Most popular</span>}
                <h3 className="lp-tier-name">{t.name}</h3>
                <p className="lp-tier-for">{t.forWho}</p>
                <p className="lp-tier-blurb">{t.blurb}</p>
                <ul className="lp-tier-features">
                  {t.features.map((feat) => (<li key={feat}>{feat}</li>))}
                </ul>
                <a href="#" className={`lp-btn ${t.featured ? "lp-btn-primary" : "lp-btn-outline"} lp-tier-cta`}>{t.cta}</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-cta-band">
        <div className="lp-container lp-cta-inner">
          <h2>Ready to get your field team organised?</h2>
          <p>Install FieldCRM from your Shopify admin and import your customers in minutes.</p>
          <a href="#pricing" className="lp-btn lp-btn-primary lp-btn-lg">Start your free trial</a>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <span className="lp-wordmark lp-wordmark-sm">Field<span>CRM</span></span>
          <p className="lp-footer-tag">Field sales CRM for B2B distributors on Shopify</p>
          <div className="lp-footer-links">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <Link href="/login">Log in</Link>
          </div>
          <p className="lp-footer-copy">© {new Date().getFullYear()} FieldCRM</p>
        </div>
      </footer>
    </div>
  );
}
