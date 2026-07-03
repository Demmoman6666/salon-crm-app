// app/api/shopify/gdpr/route.ts — Mandatory GDPR webhooks for App Store approval.
// Shopify sends: customers/data_request, customers/redact, shop/redact
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookHmac } from "@/lib/shopify-app";
import { companyFromShopDomain } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const raw = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  if (!verifyWebhookHmac(raw, hmac)) {
    return NextResponse.json({ error: "HMAC failed" }, { status: 401 });
  }

  const topic = req.headers.get("x-shopify-topic") || "";
  const shopDomain = (req.headers.get("x-shopify-shop-domain") || "").toLowerCase();
  const body = JSON.parse(raw || "{}");
  const company = await companyFromShopDomain(shopDomain);

  try {
    if (topic === "customers/redact" && company) {
      const shopifyCustomerId = String(body?.customer?.id || "");
      if (shopifyCustomerId) {
        // Anonymise rather than hard-delete so order aggregates stay intact
        await prisma.customer.updateMany({
          where: { companyId: company.id, shopifyCustomerId },
          data: {
            customerName: "REDACTED",
            customerEmailAddress: null,
            customerTelephone: null,
            addressLine1: "REDACTED",
            addressLine2: null,
            notes: null,
          },
        });
      }
    }

    if (topic === "shop/redact" && company) {
      // Shop uninstalled 48h+ ago — delete all tenant data (cascades from Company)
      await prisma.company.delete({ where: { id: company.id } });
    }

    // customers/data_request: log it; respond 200. Data export is handled manually
    // within the 30-day window per Shopify policy.
    if (topic === "customers/data_request") {
      await prisma.webhookLog.create({
        data: { companyId: company?.id ?? null, topic, payload: body },
      });
    }
  } catch (e) {
    console.error("[gdpr] handler error:", e);
  }

  return NextResponse.json({ ok: true });
}
