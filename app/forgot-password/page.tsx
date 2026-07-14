"use client";

import { useState } from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/auth/reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setSent(true); // don't reveal errors
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center" style={{ minHeight: "70vh", padding: 20 }}>
      <section className="card" style={{ maxWidth: 420, width: "100%" }}>
        <h1 style={{ marginBottom: 4 }}>Reset your password</h1>
        {sent ? (
          <>
            <p className="small muted" style={{ marginTop: 8 }}>
              If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your inbox.
            </p>
            <Link href="/login" className="btn" style={{ marginTop: 16, display: "inline-block" }}>Back to sign in</Link>
          </>
        ) : (
          <>
            <p className="small muted" style={{ marginBottom: 16 }}>
              Enter your email and we'll send you a link to reset your password.
            </p>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                placeholder="you@example.com"
              />
            </div>
            <button className="primary" style={{ width: "100%" }} onClick={submit} disabled={busy || !email.trim()}>
              {busy ? "Sending…" : "Send reset link"}
            </button>
            <Link href="/login" className="small" style={{ display: "inline-block", marginTop: 14, color: "var(--primary, #2563eb)" }}>
              Back to sign in
            </Link>
          </>
        )}
      </section>
    </div>
  );
}
