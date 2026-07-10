"use client";

import { useEffect, useState } from "react";

export const dynamic = "force-dynamic";

export default function AcceptInvitePage() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token") || "";
    setToken(t);
    if (!t) { setError("No invitation token found."); setLoading(false); return; }
    fetch(`/api/invites/accept?token=${encodeURIComponent(t)}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Invalid invitation");
        setEmail(j.email);
        setFullName(j.fullName);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function submit() {
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setSubmitting(true);
    try {
      const r = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to set password");
      window.location.href = "/"; // logged in, go to dashboard
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="center" style={{ minHeight: "70vh", padding: 20 }}>
      <section className="card" style={{ maxWidth: 420, width: "100%" }}>
        <h1 style={{ marginBottom: 4 }}>Set your password</h1>

        {loading ? (
          <p className="small muted">Checking your invitation…</p>
        ) : error && !email ? (
          <p className="form-error">{error}</p>
        ) : (
          <>
            <p className="small muted" style={{ marginBottom: 16 }}>
              Welcome{fullName ? `, ${fullName}` : ""}. Create a password to activate your FieldCRM account
              {email ? ` (${email})` : ""}.
            </p>

            <div className="field" style={{ marginBottom: 12 }}>
              <label>New password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Confirm password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
            </div>

            {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}

            <button className="primary" style={{ width: "100%" }} onClick={submit} disabled={submitting}>
              {submitting ? "Setting up…" : "Set password & sign in"}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
