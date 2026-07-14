// app/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCompanyName } from "@/lib/tenant";
import { getEntitlements } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export default async function Home() {
  const me = await getCurrentUser();
  // Lock the app when the trial has expired (exempt companies pass through).
  const ent = await getEntitlements().catch(() => null);
  if (ent?.trialExpired) redirect("/upgrade");
  const companyName = await getCompanyName();

  return (
    <div className="grid" style={{ gap: 16 }}>
      <section className="card">
        <h1>Welcome to {companyName || "your CRM"}</h1>
        <p className="small">Use the tiles below to get started.</p>
      </section>

      <section className="home-actions">
        <Link href="/saleshub" className="action-tile">
          <div className="action-title">Sales Hub</div>
          <div className="action-sub">Customers &amp; Calls</div>
        </Link>

        <Link href="/reports" className="action-tile">
          <div className="action-title">Reporting</div>
          <div className="action-sub">Call &amp; customer reporting</div>
        </Link>
      </section>
    </div>
  );
}
