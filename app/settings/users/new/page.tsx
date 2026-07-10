"use client";

import { useState } from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Role = "ADMIN" | "MANAGER" | "REP" | "VIEWER";

const ROLE_HELP: Record<Role, string> = {
  ADMIN: "Full access — settings, users, brands, all reports and data.",
  MANAGER: "All operations and reports, but no settings or user management.",
  REP: "Log calls, manage customers, view reports and the profit calculator.",
  VIEWER: "Read-only access to reports.",
};

export default function NewUserPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("REP");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const canSubmit = !!fullName.trim() && !!email.trim();

  async function submit() {
    setErr(null);
    if (!canSubmit) { setErr("Name and email are required."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, phone, role }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Failed to send invite");
      setSent(email);
      setFullName(""); setEmail(""); setPhone(""); setRole("REP");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ marginBottom: 2 }}>Invite a user</h1>
          <p className="small muted" style={{ margin: 0 }}>They'll get an email to set their own password and join.</p>
        </div>
        <Link href="/settings?tab=admin" className="btn">Back to User Management</Link>
      </div>

      {sent ? (
        <section className="card">
          <div style={{ fontWeight: 700, color: "#059669", marginBottom: 4 }}>✓ Invitation sent</div>
          <p className="small muted">An invite email is on its way to <strong>{sent}</strong>. It expires in 7 days.</p>
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <button className="primary" onClick={() => setSent(null)}>Invite another</button>
            <Link href="/settings?tab=admin" className="btn">Done</Link>
          </div>
        </section>
      ) : (
        <section className="card grid" style={{ gap: 12, maxWidth: 560 }}>
          <div className="field">
            <label>Full name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Smith" />
          </div>
          <div className="field">
            <label>Email address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
          </div>
          <div className="field">
            <label>Telephone number</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
          </div>
          <div className="field">
            <label>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="REP">Sales Rep</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin</option>
              <option value="VIEWER">Viewer</option>
            </select>
            <p className="small muted" style={{ marginTop: 6 }}>{ROLE_HELP[role]}</p>
          </div>

          {err && <div className="form-error">{err}</div>}

          <button className="primary" onClick={submit} disabled={submitting || !canSubmit}>
            {submitting ? "Sending invite…" : "Send invite"}
          </button>
        </section>
      )}
    </div>
  );
}
