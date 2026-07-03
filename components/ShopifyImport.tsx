"use client";

import { useState } from "react";

type Phase = "idle" | "customers" | "orders" | "linking" | "done" | "error";

export default function ShopifyImport({ compact = false }: { compact?: boolean }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [counts, setCounts] = useState({ customers: 0, orders: 0, linked: 0 });
  const [error, setError] = useState<string | null>(null);

  function addLog(line: string) {
    setLog((prev) => [...prev, line]);
  }

  async function run() {
    setPhase("customers");
    setError(null);
    setLog([]);
    setCounts({ customers: 0, orders: 0, linked: 0 });

    try {
      // 1) Customers — paginate on page_info until exhausted
      let custTotal = 0;
      let pageInfo: string | null = null;
      let guard = 0;
      do {
        const qs = pageInfo ? `?page_info=${encodeURIComponent(pageInfo)}` : "";
        const r = await fetch(`/api/shopify/backfill/customers${qs}`, { method: "POST" });
        if (!r.ok) throw new Error(`Customer import failed (${r.status})`);
        const j = await r.json();
        custTotal += Number(j.imported || 0);
        pageInfo = j.nextPageInfo || null;
        setCounts((c) => ({ ...c, customers: custTotal }));
        addLog(`Imported ${custTotal} customers...`);
        guard++;
      } while (pageInfo && guard < 200);

      // 2) Orders — paginate on pageInfo
      setPhase("orders");
      let ordTotal = 0;
      let ordCursor: string | null = null;
      guard = 0;
      do {
        const qs = ordCursor ? `?pageInfo=${encodeURIComponent(ordCursor)}` : "";
        const r = await fetch(`/api/shopify/backfill/all-orders${qs}`, { method: "POST" });
        if (!r.ok) throw new Error(`Order import failed (${r.status})`);
        const j = await r.json();
        ordTotal += Number(j.imported || 0);
        ordCursor = j.nextPageInfo || null;
        setCounts((c) => ({ ...c, orders: ordTotal }));
        addLog(`Imported ${ordTotal} orders...`);
        guard++;
      } while (ordCursor && guard < 200);

      // 3) Link orders to customers — loop until no remaining
      setPhase("linking");
      let linkedTotal = 0;
      guard = 0;
      let remaining = 1;
      do {
        const r = await fetch(`/api/shopify/backfill/orders-link-customers`, { method: "POST" });
        if (!r.ok) throw new Error(`Linking failed (${r.status})`);
        const j = await r.json();
        linkedTotal += Number(j.linked || 0);
        remaining = Number(j.remaining || 0);
        setCounts((c) => ({ ...c, linked: linkedTotal }));
        addLog(`Linked ${linkedTotal} orders to customers (${remaining} remaining)...`);
        guard++;
      } while (remaining > 0 && guard < 200);

      setPhase("done");
      addLog("Import complete.");
    } catch (e: any) {
      setError(e?.message || "Import failed");
      setPhase("error");
    }
  }

  const running = phase === "customers" || phase === "orders" || phase === "linking";
  const phaseLabel: Record<Phase, string> = {
    idle: "",
    customers: "Importing customers...",
    orders: "Importing orders...",
    linking: "Linking orders to customers...",
    done: "Done",
    error: "Error",
  };

  return (
    <div>
      {!compact && (
        <p className="small muted" style={{ marginBottom: 12 }}>
          Pull your existing Shopify customers and orders into the CRM. New orders sync
          automatically from now on — this is a one-time import of what already exists.
        </p>
      )}

      {phase === "idle" && (
        <button className="primary" onClick={run}>Import Shopify data</button>
      )}

      {running && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span
              style={{
                width: 16, height: 16, borderRadius: "50%",
                border: "2px solid var(--border)", borderTopColor: "var(--pink, #e6007e)",
                display: "inline-block", animation: "spin 0.8s linear infinite",
              }}
            />
            <strong>{phaseLabel[phase]}</strong>
          </div>
          <div className="small muted">
            {counts.customers} customers · {counts.orders} orders · {counts.linked} linked
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {phase === "done" && (
        <div>
          <div style={{ fontWeight: 700, color: "#166534", marginBottom: 4 }}>✓ Import complete</div>
          <div className="small muted">
            {counts.customers} customers · {counts.orders} orders · {counts.linked} linked to customers
          </div>
          <button className="btn" style={{ marginTop: 12 }} onClick={run}>Run again</button>
        </div>
      )}

      {phase === "error" && (
        <div>
          <div className="small" style={{ color: "var(--red, #dc2626)", marginBottom: 8 }}>{error}</div>
          <button className="btn" onClick={run}>Retry</button>
        </div>
      )}

      {!compact && log.length > 0 && (
        <div style={{ marginTop: 12, maxHeight: 120, overflowY: "auto", fontSize: "0.78rem", color: "var(--muted)", fontFamily: "monospace" }}>
          {log.slice(-6).map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
}
