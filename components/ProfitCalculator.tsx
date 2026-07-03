// components/ProfitCalculator.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

/* ─────────────────────────────
   Types — catalogue pulled live from Shopify
   ───────────────────────────── */
type Variant = { id: string; title: string; price: number; sku: string | null };
type Product = { id: string; title: string; vendor: string; variants: Variant[] };
type Vendor = { name: string; products: Product[] };

/* ─────────────────────────────
   Helpers
   ───────────────────────────── */
function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return "£0.00";
  return n < 0 ? `-£${Math.abs(n).toFixed(2)}` : `£${n.toFixed(2)}`;
}
function clampNum(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/* ─────────────────────────────
   Component
   ───────────────────────────── */
export default function ProfitCalculator() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // selections
  const [vendorName, setVendorName] = useState<string>("");
  const [productId, setProductId] = useState<string>("");

  // pricing
  const [cost, setCost] = useState<number>(0);     // from Shopify sell price
  const [margin, setMargin] = useState<number>(50); // % markup on cost
  const [rrp, setRrp] = useState<number>(0);        // derived, but editable
  const [rrpEdited, setRrpEdited] = useState(false); // if user overrides RRP manually

  // sales inputs
  const [days, setDays] = useState<number>(5);
  const [salespeople, setSalespeople] = useState<number>(1);
  const [unitsPerPersonPerDay, setUnitsPerPersonPerDay] = useState<number>(1);

  const [calculated, setCalculated] = useState<{
    unitsPerDay: number;
    totalUnits: number;
    totalCost: number;
    revenue: number;
    profit: number;
  } | null>(null);

  // Load catalogue from Shopify on mount
  useEffect(() => {
    fetch("/api/shopify/catalog", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || "Failed to load catalogue");
        return r.json();
      })
      .then((j) => {
        const vs: Vendor[] = j.vendors || [];
        setVendors(vs);
        if (vs.length) {
          setVendorName(vs[0].name);
          const firstProd = vs[0].products[0];
          if (firstProd) {
            setProductId(firstProd.id);
            const price = firstProd.variants[0]?.price ?? 0;
            setCost(price);
          }
        }
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.name === vendorName) || null,
    [vendors, vendorName]
  );
  const selectedProduct = useMemo(
    () => selectedVendor?.products.find((p) => p.id === productId) || selectedVendor?.products[0] || null,
    [selectedVendor, productId]
  );

  // when vendor changes → jump to its first product + price
  useEffect(() => {
    const first = selectedVendor?.products[0];
    if (!first) return;
    setProductId(first.id);
    setCost(first.variants[0]?.price ?? 0);
    setRrpEdited(false);
  }, [selectedVendor]);

  // when product changes → pull its price into Cost
  useEffect(() => {
    if (!selectedProduct) return;
    setCost(selectedProduct.variants[0]?.price ?? 0);
    setRrpEdited(false);
  }, [selectedProduct]);

  // derive RRP from cost + margin (unless the user has manually edited RRP)
  useEffect(() => {
    if (rrpEdited) return;
    const derived = (Number(cost) || 0) * (1 + (Number(margin) || 0) / 100);
    setRrp(Number(derived.toFixed(2)));
  }, [cost, margin, rrpEdited]);

  const unitProfit = Math.max(0, (rrp ?? 0) - (cost ?? 0));

  function onCalculate() {
    const d = clampNum(Math.floor(Number(days) || 0), 0, 365);
    const s = clampNum(Math.floor(Number(salespeople) || 0), 0, 500);
    const u = clampNum(Number(unitsPerPersonPerDay) || 0, 0, 1_000);

    const unitsPerDay = s * u;
    const totalUnits = unitsPerDay * d;
    const totalCost = totalUnits * (Number(cost) || 0);
    const revenue = totalUnits * (Number(rrp) || 0);
    const profit = revenue - totalCost;

    setCalculated({ unitsPerDay, totalUnits, totalCost, revenue, profit });
  }

  if (loading) {
    return <section className="card"><p className="small">Loading your Shopify catalogue…</p></section>;
  }
  if (loadError) {
    return (
      <section className="card">
        <p className="small form-error">Couldn't load catalogue: {loadError}</p>
        <p className="small muted">Make sure your Shopify products have imported and try again.</p>
      </section>
    );
  }
  if (!vendors.length) {
    return (
      <section className="card">
        <p className="small">No products found in your Shopify store yet.</p>
        <p className="small muted">Add products in Shopify, then reload this page.</p>
      </section>
    );
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div
        className="grid"
        style={{ gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", alignItems: "start" }}
      >
        {/* Product & Pricing */}
        <section className="card">
          <h3>Product &amp; Pricing</h3>

          {/* Vendor */}
          <div style={{ marginTop: 12 }}>
            <label>Vendor</label>
            <select value={vendorName} onChange={(e) => setVendorName(e.target.value)}>
              {vendors.map((v) => (
                <option key={v.name} value={v.name}>{v.name}</option>
              ))}
            </select>
          </div>

          {/* Product (scoped to vendor) */}
          <div style={{ marginTop: 10 }}>
            <label>Product</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)}>
              {selectedVendor?.products.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>

          {/* Cost + Margin + RRP */}
          <div className="row" style={{ gap: 10, marginTop: 10, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label>Cost</label>
              <input
                type="number" step="0.01" value={cost}
                onChange={(e) => setCost(Number(e.target.value))}
                placeholder="0.00"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label>Margin %</label>
              <input
                type="number" step="1" value={margin}
                onChange={(e) => { setMargin(Number(e.target.value)); setRrpEdited(false); }}
                placeholder="50"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label>RRP</label>
              <input
                type="number" step="0.01" value={rrp}
                onChange={(e) => { setRrp(Number(e.target.value)); setRrpEdited(true); }}
                placeholder="0.00"
              />
            </div>
          </div>

          <p className="small muted" style={{ marginTop: 8 }}>
            Cost is pulled from the Shopify price. RRP auto-calculates from your margin — or type your own.
          </p>
          <p className="small" style={{ marginTop: 4 }}>
            Profit (per unit): <b>{fmtMoney(unitProfit)}</b>
          </p>
        </section>

        {/* Promotion Info */}
        <section className="card">
          <h3>Promotion Details</h3>

          <div style={{ marginTop: 12 }}>
            <label>How many days are you running this promotion?</label>
            <input type="number" min={0} step="1" value={days}
              onChange={(e) => setDays(Number(e.target.value))} placeholder="e.g., 5" />
          </div>

          <div style={{ marginTop: 10 }}>
            <label>How many salespeople do you have?</label>
            <input type="number" min={0} step="1" value={salespeople}
              onChange={(e) => setSalespeople(Number(e.target.value))} placeholder="e.g., 1" />
          </div>

          <div style={{ marginTop: 10 }}>
            <label>How many units can each salesperson sell per day?</label>
            <input type="number" min={0} step="1" value={unitsPerPersonPerDay}
              onChange={(e) => setUnitsPerPersonPerDay(Number(e.target.value))} placeholder="e.g., 1" />
          </div>

          <button className="primary" style={{ marginTop: 12, width: "100%" }} onClick={onCalculate}>
            Calculate
          </button>
        </section>
      </div>

      {/* Results */}
      {calculated && (
        <div
          className="grid"
          style={{ gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", alignItems: "stretch" }}
        >
          <section className="card">
            <h3>Outcome</h3>
            <div className="small" style={{ marginTop: 10 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>Units sold per day</div>
                <div>{calculated.unitsPerDay}</div>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>Units sold over the promotion</div>
                <div>{calculated.totalUnits}</div>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>Total cost to you</div>
                <div>{fmtMoney(calculated.totalCost)}</div>
              </div>
            </div>
            <p className="small muted" style={{ marginTop: 12 }}>
              Tip: change vendor/product to auto-populate pricing, then hit Calculate.
            </p>
          </section>

          <section className="card">
            <h3>Profit</h3>
            <div className="row" style={{ justifyContent: "space-between", marginTop: 10 }}>
              <div className="small muted">Revenue generated</div>
              <div className="small" style={{ fontWeight: 600 }}>{fmtMoney(calculated.revenue)}</div>
            </div>
            <div className="row" style={{ justifyContent: "space-between", marginTop: 12, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 700 }}>Profit</div>
              <div style={{ fontWeight: 700 }}>{fmtMoney(calculated.profit)}</div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
