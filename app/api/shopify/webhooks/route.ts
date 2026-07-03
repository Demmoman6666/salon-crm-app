// app/api/shopify/webhooks/route.ts — MULTI-TENANT
// Resolves the Company from the x-shopify-shop-domain header and scopes
// every write to that company.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { companyFromShopDomain } from "@/lib/tenant";
import {
  verifyShopifyHmac,
  upsertCustomerFromShopifyById,
  upsertOrderFromShopify,
  parseShopifyTags,
  extractShopifyCustomerId,
  shopifyGraphql,
  fetchVariantUnitCosts,
  gidToNumericId,
} from "@/lib/shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ok(text = "ok", code = 200) {
  return new NextResponse(text, { status: code });
}
function bad(msg: string, code = 400) {
  console.error(msg);
  return new NextResponse(msg, { status: code });
}

function toNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function GET() {
  return ok();
}

export async function POST(req: Request) {
  const topic = (req.headers.get("x-shopify-topic") || "").toLowerCase();
  const shop = (req.headers.get("x-shopify-shop-domain") || "").toLowerCase();
  const hmac = req.headers.get("x-shopify-hmac-sha256");

  const raw = await req.arrayBuffer();
  if (!verifyShopifyHmac(raw, hmac)) {
    return bad(
      `Shopify webhook HMAC failed { topic: '${topic}', shopDomain: '${shop}' }`,
      401
    );
  }

  // Resolve tenant from the shop domain
  const company = await companyFromShopDomain(shop);
  if (!company) {
    // Unknown store — 200 so Shopify doesn't retry forever, but log it
    console.warn(`[WEBHOOK] no company for shop '${shop}' topic '${topic}'`);
    return ok("unknown shop");
  }
  const companyId = company.id;

  let body: any;
  try {
    body = JSON.parse(Buffer.from(raw).toString("utf8"));
  } catch (e: any) {
    return bad(`Invalid JSON: ${e?.message || String(e)}`, 400);
  }

  try {
    // ───────── app/uninstalled → mark tenant uninstalled ─────────
    if (topic === "app/uninstalled") {
      await prisma.company.update({
        where: { id: companyId },
        data: { uninstalledAt: new Date(), shopifyAccessToken: null },
      });
      console.log(`[WEBHOOK] app uninstalled for ${shop}`);
      return ok();
    }

    // ───────── inventory_items/update → cache unit cost per variant ─────────
    if (topic === "inventory_items/update") {
      const invId =
        String(body?.inventory_item?.id ?? body?.id ?? body?.inventory_item_id ?? "") || "";
      if (!invId) {
        console.warn("[WEBHOOK] inventory_items/update missing inventory_item.id");
        return ok();
      }

      const q = `
        query InvItem($id: ID!) {
          inventoryItem(id: $id) {
            unitCost { amount currencyCode }
            variant { legacyResourceId }
          }
        }`;
      type Gx = {
        inventoryItem: {
          unitCost?: { amount: string; currencyCode: string } | null;
          variant?: { legacyResourceId?: string | null } | null;
        } | null;
      };

      try {
        const data = await shopifyGraphql<Gx>(companyId, q, {
          id: `gid://shopify/InventoryItem/${invId}`,
        });

        const legacyVariantId = data?.inventoryItem?.variant?.legacyResourceId;
        const amountStr = data?.inventoryItem?.unitCost?.amount ?? null;
        const currency = data?.inventoryItem?.unitCost?.currencyCode ?? "GBP";

        if (!legacyVariantId || amountStr == null) {
          return ok();
        }

        const unitCost = Number(amountStr);

        await prisma.shopifyVariantCost.upsert({
          where: { companyId_variantId: { companyId, variantId: String(legacyVariantId) } },
          create: { companyId, variantId: String(legacyVariantId), unitCost, currency },
          update: { unitCost, currency },
        });
      } catch (e) {
        console.error("[WEBHOOK] inventory_items/update error:", e);
      }
      return ok();
    }

    // ───────── products/update → refresh costs for all variants ─────────
    if (topic === "products/update") {
      const variants = Array.isArray(body?.variants)
        ? body.variants
        : Array.isArray(body?.product?.variants)
        ? body.product.variants
        : [];

      const variantIds = (variants as any[])
        .map((v) => {
          if (v?.id != null && typeof v.id !== "object") return `${v.id}`;
          if (v?.admin_graphql_api_id) {
            const n = gidToNumericId(String(v.admin_graphql_api_id));
            if (n) return n;
          }
          return null;
        })
        .filter(Boolean) as string[];

      if (!variantIds.length) return ok();

      try {
        const costMap = await fetchVariantUnitCosts(companyId, variantIds);
        for (const [variantId, entry] of costMap.entries()) {
          await prisma.shopifyVariantCost.upsert({
            where: { companyId_variantId: { companyId, variantId: `${variantId}` } },
            create: { companyId, variantId: `${variantId}`, unitCost: entry.unitCost, currency: entry.currency },
            update: { unitCost: entry.unitCost, currency: entry.currency },
          });
        }
      } catch (e) {
        console.error("[WEBHOOK] products/update cost-refresh error:", e);
      }
      return ok();
    }

    // ───────── refunds/create → apply full/partial refunds ─────────
    if (topic === "refunds/create") {
      const refundId = String(body?.id ?? body?.refund?.id ?? "");
      if (refundId) {
        const seen = await prisma.webhookLog.findFirst({
          where: { companyId, topic: "refunds/create", shopifyId: refundId },
          select: { id: true },
        });
        if (seen) return ok("duplicate");
      }

      const refund = body?.refund ?? body;
      const orderIdStr = String(
        refund?.order_id ?? body?.order_id ?? refund?.order?.id ?? ""
      );

      if (!orderIdStr) {
        if (refundId) {
          await prisma.webhookLog.create({
            data: { companyId, topic: "refunds/create", shopifyId: refundId, payload: body },
          });
        }
        return ok();
      }

      let refundedNet = 0;
      let refundedTax = 0;
      let refundedShipping = 0;

      const refundLineItems: any[] = Array.isArray(refund?.refund_line_items)
        ? refund.refund_line_items
        : [];

      for (const rli of refundLineItems) {
        const sub =
          toNum(rli?.subtotal) ||
          toNum(rli?.subtotal_set?.shop_money?.amount) ||
          toNum(rli?.subtotal_set?.presentment_money?.amount);
        const tax =
          toNum(rli?.total_tax) ||
          toNum(rli?.total_tax_set?.shop_money?.amount) ||
          toNum(rli?.total_tax_set?.presentment_money?.amount);

        refundedNet += sub;
        refundedTax += tax;

        const qty = Number(rli?.quantity ?? 0) || 0;
        const liId = String(rli?.line_item_id ?? rli?.line_item?.id ?? "") || "";

        if (liId) {
          try {
            await prisma.orderLineItem.updateMany({
              where: { companyId, shopifyLineItemId: liId },
              data: { refundedQuantity: { increment: qty } },
            });
          } catch {
            // If we don't have this line item cached yet, ignore.
          }
        }
      }

      const shippingRefund = refund?.shipping || refund?.refund_shipping;
      if (shippingRefund) {
        refundedShipping += toNum(shippingRefund.amount);
        refundedTax += toNum(shippingRefund.tax);
      }

      const adjustments: any[] = Array.isArray(refund?.order_adjustments)
        ? refund.order_adjustments
        : [];
      for (const adj of adjustments) {
        const amount = toNum(adj?.amount);
        const taxAmount = toNum(adj?.tax_amount);
        const kind = String(adj?.kind || "").toLowerCase();
        if (kind.includes("shipping")) {
          refundedShipping += amount;
          refundedTax += taxAmount;
        } else {
          refundedNet += amount;
          refundedTax += taxAmount;
        }
      }

      const refundedTotal = refundedNet + refundedTax + refundedShipping;

      await prisma.order.upsert({
        where: { companyId_shopifyOrderId: { companyId, shopifyOrderId: orderIdStr } },
        create: {
          companyId,
          shopifyOrderId: orderIdStr,
          refundedNet,
          refundedTax,
          refundedShipping,
          refundedTotal,
        },
        update: {
          refundedNet: { increment: refundedNet },
          refundedTax: { increment: refundedTax },
          refundedShipping: { increment: refundedShipping },
          refundedTotal: { increment: refundedTotal },
        },
      });

      if (refundId) {
        await prisma.webhookLog.create({
          data: { companyId, topic: "refunds/create", shopifyId: refundId, payload: body },
        });
      }

      return ok();
    }

    // ───────── customers (CREATE / UPDATE) ─────────
    if (topic === "customers/create" || topic === "customers/update") {
      const payload = body?.customer ?? body;
      const shopifyId = extractShopifyCustomerId(payload);

      await upsertCustomerFromShopifyById(companyId, String(shopifyId), {
        updateOnly: false,
        matchBy: "shopifyIdOrEmail",
      });
      return ok();
    }

    // ───────── tag delta webhooks: UPDATE EXISTING ONLY ─────────
    if (topic === "customer.tags_added" || topic === "customer.tags_removed") {
      const shopifyId =
        extractShopifyCustomerId(body) ?? extractShopifyCustomerId(body?.customer);

      if (!shopifyId) return ok();

      await upsertCustomerFromShopifyById(companyId, String(shopifyId), {
        updateOnly: true,
        matchBy: "shopifyIdOnly",
      });
      return ok();
    }

    // ───────── orders ─────────
    if (
      topic === "orders/create" ||
      topic === "orders/updated" ||
      topic === "orders/paid" ||
      topic === "orders/fulfilled" ||
      topic === "orders/partially_fulfilled"
    ) {
      const order = body?.order ?? body;
      await upsertOrderFromShopify(companyId, order);
      return ok();
    }

    console.log(`[WEBHOOK] ignored topic '${topic}' from ${shop}`);
    return ok();
  } catch (err: any) {
    console.error(`[WEBHOOK] handler error for ${topic}:`, err?.stack || err?.message || err);
    return bad("Handler failed", 500);
  }
}
