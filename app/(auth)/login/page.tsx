// app/(auth)/login/page.tsx
"use client";

import { useEffect, useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [nextUrl, setNextUrl] = useState("/home");

  // Read ?next=... without useSearchParams (avoids suspense warning)
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const p = url.searchParams.get("next");
      if (p && p.startsWith("/")) setNextUrl(p);
    } catch {}
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setSubmitting(true);

    try {
      const fd = new FormData();
      fd.set("email", email.trim());
      fd.set("password", password);

      const res = await fetch("/api/login", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Sign-in failed");

      // Cookie is set by the API; send them on their way
      window.location.href = nextUrl;
    } catch (err: any) {
      setMsg(err?.message || "Sign-in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        background: "#fff",
        padding: 24,
      }}
    >
      <div className="card" style={{ width: 420, maxWidth: "90vw", padding: 20 }}>
        <div style={{ textAlign: "center", marginBottom: 20, marginTop: 8 }}>
          <span style={{ fontSize: "1.9rem", fontWeight: 800, letterSpacing: "-0.03em", color: "#0f172a" }}>
            Field<span style={{ color: "#2563eb" }}>CRM</span>
          </span>
          <p className="small muted" style={{ margin: "6px 0 0" }}>Sign in to your account</p>
        </div>
        <form method="post" action="/api/login" onSubmit={onSubmit} className="grid" style={{ gap: 12 }}>
          <div>
            <label className="sr-only">Email</label>
            <input
              name="email"
              type="email"
              className="input"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label className="sr-only">Password</label>
            <div className="row" style={{ gap: 8 }}>
              <input
                name="password"
                type={show ? "text" : "password"}
                className="input"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="current-password"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button className="primary" type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>

          <a href="/forgot-password" className="small" style={{ display: "block", textAlign: "center", marginTop: 12, color: "#2563eb" }}>
            Forgot password?
          </a>

          {msg && (
            <div className="small" style={{ color: "#b91c1c", textAlign: "center" }}>
              {msg}
            </div>
          )}

          <p className="small muted" style={{ marginTop: 6, textAlign: "center" }}>
            Trouble signing in? Contact your admin.
          </p>

          {/* Progressive enhancement: if JS is disabled, the form still posts to /api/login */}
          <input type="hidden" name="__enhanced" value="1" />
        </form>
      </div>
    </div>
  );
}
