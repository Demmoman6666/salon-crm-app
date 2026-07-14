"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [validErr, setValidErr] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token") || "";
    setToken(t);
    if (!t) { setValidErr("No reset token found."); setLoading(false); return; }
    fetch(`/api/auth/reset?token=${encodeURIComponent(t)}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Invalid link");
      })
      .catch((e) => setValidErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function submit() {
    setErr(null);
    if (password.length < 8) { setErr("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setErr("Passwords don't match."); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to reset password");
      setDone(true);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center" style={{ minHeight: "70vh", padding: 20 }}>
      <section className="card" style={{ maxWidth: 420, width: "100%" }}>
        <h1 style={{ marginBottom: 4 }}>Choose a new password</h1>

        {loading ? (
          <p className="small muted">Checking your link…</p>
        ) : validErr ? (
          <>
            <p className="form-error" style={{ marginTop: 8 }}>{validErr}</p>
            <Link href="/forgot-password" className="btn" style={{ marginTop: 14, display: "inline-block" }}>Request a new link</Link>
          </>
        ) : done ? (
          <>
            <p className="small muted" style={{ marginTop: 8 }}>Your password has been reset.</p>
            <Link href="/login" className="primary" style={{ marginTop: 16, display: "inline-block" }}>Sign in</Link>
          </>
        ) : (
          <>
            <div className="field" style={{ marginTop: 12, marginBottom: 12 }}>
              <label>New password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Confirm password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
            </div>
            {err && <div className="form-error" style={{ marginBottom: 12 }}>{err}</div>}
            <button className="primary" style={{ width: "100%" }} onClick={submit} disabled={busy}>
              {busy ? "Saving…" : "Reset password"}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
