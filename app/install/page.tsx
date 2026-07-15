"use client";

import { useState } from "react";
import Link from "next/link";
import "../landing.css";

export const dynamic = "force-dynamic";

export default function InstallPage() {
  const [shop, setShop] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function normalise(raw: string): string | null {
    let s = raw.trim().toLowerCase();
    if (!s) return null;
    // strip protocol / paths
    s = s.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    // allow "mystore" -> "mystore.myshopify.com"
    if (!s.includes(".")) s = `${s}.myshopify.com`;
    // if they typed a custom domain, we can't resolve it — require myshopify.com
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s)) return null;
    return s;
  }

  function start() {
    setErr(null);
    const domain = normalise(shop);
    if (!domain) {
      setErr("Enter your Shopify store domain, e.g. your-store.myshopify.com");
      return;
    }
    window.location.href = `/api/shopify/auth?shop=${encodeURIComponent(domain)}`;
  }

  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-container lp-nav-inner">
          <Link href="/" className="lp-wordmark" style={{ textDecoration: "none" }}>
            Field<span>CRM</span>
          </Link>
          <nav className="lp-nav-links">
            <Link href="/login" className="lp-link-login">Log in</Link>
          </nav>
        </div>
      </header>

      <section className="lp-hero" style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="lp-grid-bg" aria-hidden />
        <div className="lp-container" style={{ position: "relative", zIndex: 2, maxWidth: 560, textAlign: "center", margin: "0 auto" }}>
          <p className="lp-eyebrow">Start your 14-day free trial</p>
          <h1 className="lp-hero-title" style={{ fontSize: "clamp(30px, 5vw, 44px)" }}>
            Connect your Shopify store
          </h1>
          <p className="lp-hero-sub" style={{ marginBottom: 28 }}>
            Enter your store's <strong>.myshopify.com</strong> domain and we'll take you to Shopify
            to install FieldCRM. No card required to start.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 440, margin: "0 auto", textAlign: "left" }}>
            <input
              value={shop}
              onChange={(e) => setShop(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") start(); }}
              placeholder="your-store.myshopify.com"
              autoFocus
              style={{
                padding: "14px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.25)",
                background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 16, outline: "none",
              }}
            />
            {err && <div style={{ color: "#fca5a5", fontSize: 14 }}>{err}</div>}
            <button className="lp-btn lp-btn-primary lp-btn-lg" onClick={start} style={{ width: "100%" }}>
              Continue to Shopify
            </button>
          </div>

          <p className="lp-hero-note" style={{ marginTop: 20 }}>
            Don't know your domain? It's the address you use to log in to your Shopify admin,
            ending in <strong>.myshopify.com</strong>.
          </p>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <Link href="/" className="lp-wordmark lp-wordmark-sm" style={{ textDecoration: "none" }}>
            Field<span>CRM</span>
          </Link>
          <p className="lp-footer-copy">© {new Date().getFullYear()} FieldCRM</p>
        </div>
      </footer>
    </div>
  );
}
