"use client";

// Shared plan comparison table — used on the public landing page and the in-app upgrade page.

type Row = { label: string; starter: string | boolean; growth: string | boolean; pro: string | boolean; group?: boolean };

const ROWS: Row[] = [
  { label: "Sales reps", starter: "3", growth: "10", pro: "Unlimited" },
  { label: "Core CRM", starter: true, growth: true, pro: true, group: true },
  { label: "Customers & call logging", starter: true, growth: true, pro: true },
  { label: "Order building (Shopify sync)", starter: true, growth: true, pro: true },
  { label: "Core reporting", starter: true, growth: true, pro: true },
  { label: "Field tools", starter: false, growth: true, pro: true, group: true },
  { label: "Coverage map & territory view", starter: false, growth: true, pro: true },
  { label: "GAP analysis", starter: false, growth: true, pro: true },
  { label: "Rep scorecards", starter: false, growth: true, pro: true },
  { label: "AI call briefs", starter: false, growth: true, pro: true },
  { label: "Profit calculator", starter: false, growth: true, pro: true },
  { label: "Advanced reporting", starter: false, growth: false, pro: true },
  { label: "Support", starter: false, growth: false, pro: false, group: true },
  { label: "Standard support", starter: true, growth: true, pro: true },
  { label: "Priority support", starter: false, growth: true, pro: true },
  { label: "Dedicated support", starter: false, growth: false, pro: true },
];

function Cell({ v }: { v: string | boolean }) {
  if (typeof v === "string") return <span className="lp-cmp-text">{v}</span>;
  return v ? (
    <svg className="lp-cmp-yes" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-label="Included"><path d="M20 6L9 17l-5-5" /></svg>
  ) : (
    <span className="lp-cmp-no" aria-label="Not included">—</span>
  );
}

export default function PlanComparison() {
  return (
    <div className="lp-cmp-wrap">
      <table className="lp-cmp">
        <thead>
          <tr>
            <th className="lp-cmp-feat"></th>
            <th>Starter</th>
            <th className="lp-cmp-featured">Growth</th>
            <th>Pro</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) =>
            r.group ? (
              <tr className="lp-cmp-group" key={r.label}>
                <td colSpan={4}>{r.label}</td>
              </tr>
            ) : (
              <tr key={r.label}>
                <td className="lp-cmp-feat">{r.label}</td>
                <td><Cell v={r.starter} /></td>
                <td className="lp-cmp-featured"><Cell v={r.growth} /></td>
                <td><Cell v={r.pro} /></td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
