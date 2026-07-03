// app/api/billing/callback/route.ts — Merchant approved the charge.
// Shopify redirects here with ?charge_id=...
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("companyId") || "";
  const plan = url.searchParams.get("plan") || "starter";
  const chargeId = url.searchParams.get("charge_id") || "";

  if (companyId) {
    await prisma.company.update({
      where: { id: companyId },
      data: { plan, billingChargeId: chargeId || null, billingActivatedAt: new Date() },
    }).catch(() => {});
  }

  return NextResponse.redirect(new URL("/?billing=active", url.origin));
}
