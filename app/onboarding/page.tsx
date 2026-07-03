"use client";

import { useState } from "react";
import ShopifyImport from "@/components/ShopifyImport";

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [brands, setBrands] = useState<string[]>([]);
  const [brandInput, setBrandInput] = useState("");
  const [reps, setReps] = useState<string[]>([]);
  const [repInput, setRepInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const companyId =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("companyId") || ""
      : "";

  function addBrand() {
    const v = brandInput.trim();
    if (v && !brands.includes(v)) setBrands(prev => [...prev, v]);
    setBrandInput("");
  }
  function addRep() {
    const v = repInput.trim();
    if (v && !reps.includes(v)) setReps(prev => [...prev, v]);
    setRepInput("");
  }

  function finish() {
    setSaving(true);
    setError(null);
    fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, companyName, adminName, adminEmail, adminPassword, brands, reps }),
    })
      .then(r => r.json().then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) throw new Error(j.error || "Setup failed");
        setStep(6);
      })
      .catch((e: any) => setError(e.message))
      .finally(() => setSaving(false));
  }

  const steps = ["Your company", "Your account", "Your brands", "Your reps", "Review", "Import"];

  return (
    <div style={{ maxWidth: 560, margin: "40px auto", padding: "0 16px" }}>
      <section className="card">
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {steps.map((s, i) => (
            <div key={s} style={{ flex: 1, height: 4, borderRadius: 999, background: i < step ? "var(--pink)" : "var(--surface-2)" }} />
          ))}
        </div>

        {step === 1 && (
          <div>
            <h1 style={{ marginBottom: 4 }}>Welcome to FieldCRM</h1>
            <p className="small muted" style={{ marginBottom: 16 }}>Let&apos;s get your CRM set up. First — what&apos;s your company called?</p>
            <div className="field" style={{ marginBottom: 16 }}>
              <label>Company name</label>
              <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Salon Supplies Direct" />
            </div>
            <button className="primary" style={{ width: "100%" }} disabled={!companyName.trim()} onClick={() => setStep(2)}>Continue</button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 style={{ marginBottom: 4 }}>Your admin account</h1>
            <p className="small muted" style={{ marginBottom: 16 }}>This is how you&apos;ll log in to the CRM.</p>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Your name</label>
              <input value={adminName} onChange={e => setAdminName(e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Email</label>
              <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 16 }}>
              <label>Password</label>
              <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => setStep(1)}>Back</button>
              <button className="primary" style={{ flex: 1 }} disabled={!adminName.trim() || !adminEmail.trim() || adminPassword.length < 8} onClick={() => setStep(3)}>Continue</button>
            </div>
            {adminPassword.length > 0 && adminPassword.length < 8 && <p className="small muted" style={{ marginTop: 8 }}>Password must be at least 8 characters.</p>}
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 style={{ marginBottom: 4 }}>Brands you distribute</h1>
            <p className="small muted" style={{ marginBottom: 16 }}>Add the product brands you sell. You can change these later in Settings.</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input value={brandInput} onChange={e => setBrandInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addBrand())} placeholder="e.g. REF Stockholm" style={{ flex: 1 }} />
              <button className="btn" onClick={addBrand}>Add</button>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16, minHeight: 32 }}>
              {brands.map(b => (
                <span key={b} style={{ padding: "4px 12px", borderRadius: 999, background: "var(--pink-light)", color: "var(--pink-dark)", fontWeight: 600, fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {b}
                  <button onClick={() => setBrands(prev => prev.filter(x => x !== b))} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, minHeight: "auto" }}>×</button>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => setStep(2)}>Back</button>
              <button className="primary" style={{ flex: 1 }} onClick={() => setStep(4)}>Continue</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h1 style={{ marginBottom: 4 }}>Your sales reps</h1>
            <p className="small muted" style={{ marginBottom: 16 }}>Add your field sales team. You can invite them as users later.</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input value={repInput} onChange={e => setRepInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addRep())} placeholder="Rep name" style={{ flex: 1 }} />
              <button className="btn" onClick={addRep}>Add</button>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16, minHeight: 32 }}>
              {reps.map(r => (
                <span key={r} style={{ padding: "4px 12px", borderRadius: 999, background: "var(--surface-2)", fontWeight: 600, fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {r}
                  <button onClick={() => setReps(prev => prev.filter(x => x !== r))} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, minHeight: "auto" }}>×</button>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => setStep(3)}>Back</button>
              <button className="primary" style={{ flex: 1 }} onClick={() => setStep(5)}>Continue</button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <h1 style={{ marginBottom: 4 }}>Ready to go</h1>
            <p className="small muted" style={{ marginBottom: 16 }}>
              {companyName} · {brands.length} brand{brands.length === 1 ? "" : "s"} · {reps.length} rep{reps.length === 1 ? "" : "s"}.
              Your Shopify orders and customers will sync automatically.
            </p>
            {error && <div className="small" style={{ color: "var(--red)", marginBottom: 12 }}>{error}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => setStep(4)}>Back</button>
              <button className="primary" style={{ flex: 1 }} disabled={saving} onClick={finish}>
                {saving ? "Setting up..." : "Create Account"}
              </button>
            </div>
          </div>
        )}

        {step === 6 && (
          <div>
            <h1 style={{ marginBottom: 4 }}>Import your Shopify data</h1>
            <p className="small muted" style={{ marginBottom: 16 }}>
              Bring your existing customers and orders into the CRM now, or skip and do it
              later from Settings. New orders always sync automatically.
            </p>
            <ShopifyImport />
            <div style={{ display: "flex", gap: 8, marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => (window.location.href = "/")}>
                Skip for now
              </button>
              <button className="primary" style={{ flex: 1 }} onClick={() => (window.location.href = "/")}>
                Go to dashboard
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
