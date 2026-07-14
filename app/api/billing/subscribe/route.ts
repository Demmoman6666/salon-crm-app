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

    // Accept both JSON ({plan}) and HTML form posts (plan=...).
    let plan = "";
    const ctype = req.headers.get("content-type") || "";
    if (ctype.includes("application/json")) {
      plan = (await req.json())?.plan || "";
    } else {
      const fd = await req.formData();
      plan = String(fd.get("plan") || "");
    }

    if (!PLANS[plan]) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });

    const { confirmationUrl } = await createSubscription(t.companyId, plan);

    // Form posts → redirect straight to Shopify's confirmation page.
    if (!ctype.includes("application/json")) {
      return NextResponse.redirect(confirmationUrl, { status: 303 });
    }
    return NextResponse.json({ confirmationUrl });
  } catch (e: any) {
    const status = e instanceof TenantError ? e.status : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}
