// app/api/billing/subscribe/route.ts — Start a Shopify subscription.
// POST { plan: "starter" | "growth" | "pro" } → { confirmationUrl }
import { NextResponse } from "next/server";
import { requireTenant, TenantError } from "@/lib/tenant";
import { createSubscription, PLANS } from "@/lib/shopify-app";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const t = await requireTenant();
    const { plan } = await req.json();
    if (!PLANS[plan]) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });

    const { confirmationUrl } = await createSubscription(t.companyId, plan);
    return NextResponse.json({ confirmationUrl });
  } catch (e: any) {
    const status = e instanceof TenantError ? e.status : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}
