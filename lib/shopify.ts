// lib/shopify.ts — MULTI-TENANT
// Every function that touches the Shopify API or the database takes
// `companyId` as its FIRST parameter. Credentials come from the Company row.
import { prisma } from "@/lib/prisma";
import { resolveStageAfterOrder } from "@/lib/pipeline";
import crypto from "crypto";

export const SHOPIFY_API_VERSION = (process.env.SHOPIFY_API_VERSION || "2025-01").trim();
const DEFAULT_DRAFT_TAG = (process.env.SHOPIFY_DRAFT_TAG || "CRM").trim();

// App-level secret (Partner Dashboard) — used for ALL webhook HMACs in a Shopify app
const APP_API_SECRET = (process.env.SHOPIFY_API_SECRET || "").trim();
const DISABLE_HMAC = (process.env.SHOPIFY_DISABLE_HMAC || "") === "1";

/** ───────────────── Per-company credentials (60s cache) ───────────────── */
type Creds = { shopDomain: string; token: string; ts: number };
const credsCache = new Map<string, Creds>();

async function getCreds(companyId: string): Promise<{ shopDomain: string; token: string }> {
  const hit = credsCache.get(companyId);
  if (hit && Date.now() - hit.ts < 60_000) return hit;
  const c = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      shopDomain: true,
      shopifyAccessToken: true,
      shopifyRefreshToken: true,
      shopifyTokenExpiresAt: true,
      uninstalledAt: true,
    },
  });
  if (!c?.shopDomain || !c.shopifyAccessToken || c.uninstalledAt) {
    throw new Error("Shopify is not connected for this company");
  }

  let token = c.shopifyAccessToken;

  // If the token is expiring (or already expired) and we have a refresh token,
  // refresh it now. 5-minute safety margin before expiry.
  const expiresAt = c.shopifyTokenExpiresAt ? new Date(c.shopifyTokenExpiresAt).getTime() : null;
  const needsRefresh = expiresAt !== null && expiresAt - Date.now() < 5 * 60 * 1000;

  if (needsRefresh && c.shopifyRefreshToken) {
    try {
      const { refreshAccessToken } = await import("@/lib/shopify-app");
      const refreshed = await refreshAccessToken(c.shopDomain, c.shopifyRefreshToken);
      token = refreshed.access_token;
      const newExpiry = refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : null;
      // Persist the new pair (refresh tokens rotate — must save the new one)
      await prisma.company.update({
        where: { id: companyId },
        data: {
          shopifyAccessToken: refreshed.access_token,
          shopifyRefreshToken: refreshed.refresh_token ?? c.shopifyRefreshToken,
          shopifyTokenExpiresAt: newExpiry,
        },
      });
      credsCache.delete(companyId);
    } catch (e) {
      // If refresh fails, fall through with the existing token; the API call will
      // surface the real error (and the merchant may need to reauthorize).
      console.error("Shopify token refresh failed:", (e as any)?.message || e);
    }
  }

  const creds = { shopDomain: c.shopDomain, token, ts: Date.now() };
  credsCache.set(companyId, creds);
  return creds;
}

/** ───────────────── Small utils ───────────────── */
function toNumber(v: any): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function parseShopifyTags(input: any): string[] {
  if (Array.isArray(input)) return input.map(String).map(s => s.trim()).filter(Boolean);
  if (typeof input === "string") return input.split(",").map(s => s.trim()).filter(Boolean);
  return [];
}
function tagsToString(tags: string[]): string {
  return Array.from(new Set(tags.map(t => t.trim()).filter(Boolean))).join(", ");
}

export function gidToNumericId(gid?: string | null): string | null {
  if (!gid || typeof gid !== "string") return null;
  const m = gid.match(/\/(\d+)$/);
  return m ? m[1] : null;
}
export function numericVariantIdToGid(id: string | number): string {
  return `gid://shopify/ProductVariant/${id}`;
}

/** ───────────────── REST Admin helper (per-company) ───────────────── */
export async function shopifyRest(companyId: string, path: string, init: RequestInit = {}) {
  const { shopDomain, token } = await getCreds(companyId);
  const url = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}${path}`;
  const headers = new Headers(init.headers as any);
  headers.set("X-Shopify-Access-Token", token);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  return fetch(url, { ...init, headers, cache: "no-store" });
}

/** ───────────────── GraphQL Admin helper (per-company) ───────────────── */
export async function shopifyGraphql<T = any>(companyId: string, query: string, variables?: Record<string, any>): Promise<T> {
  const { shopDomain, token } = await getCreds(companyId);
  const url = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json?.errors) {
    throw new Error(`Shopify GraphQL error: ${res.status} ${JSON.stringify(json?.errors || json)}`);
  }
  return json.data as T;
}

export { shopifyGraphql as shopifyGraphQL };

/** Fail fast if app-level env is missing (API key/secret from Partner Dashboard). */
export function requireShopifyEnv() {
  if (!process.env.SHOPIFY_API_KEY) throw new Error("Missing SHOPIFY_API_KEY");
  if (!APP_API_SECRET) throw new Error("Missing SHOPIFY_API_SECRET");
}

/** ───────────────── Webhook HMAC (app secret) ───────────────── */
export function verifyShopifyHmac(rawBody: ArrayBuffer | Buffer | string, hmacHeader?: string | null) {
  if (DISABLE_HMAC) return true;
  if (!hmacHeader || !APP_API_SECRET) return false;
  const bodyBuf =
    typeof rawBody === "string"
      ? Buffer.from(rawBody, "utf8")
      : Buffer.isBuffer(rawBody)
      ? rawBody
      : Buffer.from(rawBody as ArrayBuffer);
  const providedBytes = Buffer.from(hmacHeader, "base64");
  const digestBytes = crypto.createHmac("sha256", APP_API_SECRET).update(bodyBuf).digest();
  try {
    return providedBytes.length === digestBytes.length && crypto.timingSafeEqual(providedBytes, digestBytes);
  } catch {
    return false;
  }
}

/** ───────────────── Sales Rep mapping (per-company) ───────────────── */
export async function getSalesRepForTags(companyId: string, tags: string[]): Promise<string | null> {
  if (!tags?.length) return null;
  const norm = tags.map(t => t.trim()).filter(Boolean);

  const rule = await prisma.salesRepTagRule.findFirst({
    where: { companyId, tag: { in: norm } },
    include: { salesRep: true },
    orderBy: { createdAt: "asc" },
  });
  if (rule?.salesRep?.name) return rule.salesRep.name;

  const reps = await prisma.salesRep.findMany({ where: { companyId }, select: { name: true } });
  const byLower = new Map(reps.map(r => [r.name.toLowerCase(), r.name]));
  for (const t of norm) {
    const hit = byLower.get(t.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

/** ───────────────── Customer fetch / id helpers ───────────────── */
async function fetchShopifyCustomerById(companyId: string, shopifyId: string): Promise<any | null> {
  if (!shopifyId) return null;
  const res = await shopifyRest(companyId, `/customers/${shopifyId}.json`, { method: "GET" });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.customer ?? null;
}

export function extractShopifyCustomerId(payload: any): string | null {
  if (!payload || typeof payload !== "object") return null;
  if (payload.customer_id != null) return String(payload.customer_id);
  if (payload.customer?.id != null) return String(payload.customer.id);
  if (payload.id != null && typeof payload.id !== "object") return String(payload.id);
  const gid: string | undefined =
    payload.admin_graphql_api_id || payload.customer?.admin_graphql_api_id;
  if (gid && typeof gid === "string") {
    const m = gid.match(/\/Customer\/(\d+)$/);
    if (m) return m[1];
  }
  return null;
}

/** ───────────────── Inbound upserts (Shopify → CRM) ───────────────── */
type UpsertOpts = {
  updateOnly?: boolean;
  matchBy?: "shopifyIdOnly" | "shopifyIdOrEmail";
};

export async function upsertCustomerFromShopifyById(
  companyId: string,
  shopCustomerId: string,
  opts?: UpsertOpts
) {
  const full = await fetchShopifyCustomerById(companyId, shopCustomerId);
  if (!full) {
    console.warn(`[WEBHOOK] fetch failed for Shopify customer ${shopCustomerId}`);
    return;
  }
  await upsertCustomerFromShopify(companyId, full, opts);
}

export async function upsertCustomerFromShopify(
  companyId: string,
  shop: any,
  opts?: UpsertOpts
) {
  const shopifyId = extractShopifyCustomerId(shop);
  const email: string | null = (shop.email || "").toLowerCase() || null;

  const addr = shop.default_address || {};
  const fullName = [shop.first_name, shop.last_name].filter(Boolean).join(" ").trim();
  const company = addr.company || "";
  const phone = shop.phone || addr.phone || null;

  const tags = "tags" in shop ? parseShopifyTags(shop.tags) : [];
  const repName = await getSalesRepForTags(companyId, tags);

  const base = {
    salonName: company || fullName || "Shopify Customer",
    customerName: fullName || company || "Unknown",
    addressLine1: addr.address1 || "",
    addressLine2: addr.address2 || null,
    town: addr.city || null,
    county: addr.province || null,
    postCode: addr.zip || null,
    country: addr.country || null,
    customerEmailAddress: email,
    customerTelephone: phone,
    shopifyCustomerId: shopifyId || null,
  };

  const matchMode = opts?.matchBy ?? "shopifyIdOrEmail";
  let existing: { id: string } | null = null;
  if (shopifyId) {
    existing = await prisma.customer.findFirst({ where: { companyId, shopifyCustomerId: shopifyId } });
  }
  if (!existing && matchMode === "shopifyIdOrEmail" && email) {
    existing = await prisma.customer.findFirst({ where: { companyId, customerEmailAddress: email } });
  }

  if (existing) {
    const data: any = { ...base };
    if ("tags" in shop) data.shopifyTags = { set: tags };
    if (repName) data.salesRep = repName;
    await prisma.customer.update({ where: { id: existing.id }, data });
    return;
  }

  if (opts?.updateOnly) return;

  const createData: any = { ...base, companyId };
  if ("tags" in shop) createData.shopifyTags = tags;
  if (repName) createData.salesRep = repName;
  await prisma.customer.create({ data: createData });
}

/** Orders (Shopify → CRM) */
export async function upsertOrderFromShopify(companyId: string, order: any) {
  const orderId = String(order.id);
  const custShopId = order.customer ? String(order.customer.id) : null;

  const linkedCustomer =
    custShopId ? await prisma.customer.findFirst({ where: { companyId, shopifyCustomerId: custShopId } }) : null;

  const shippingFromSet =
    order?.total_shipping_price_set?.shop_money?.amount ??
    order?.total_shipping_price_set?.presentment_money?.amount ?? null;
  const shipping = toNumber(shippingFromSet) ?? toNumber(order?.shipping_lines?.[0]?.price) ?? null;

  const common = {
    shopifyOrderNumber: order.order_number ?? null,
    shopifyName: order.name ?? null,
    shopifyCustomerId: custShopId ?? null,
    customerId: linkedCustomer ? linkedCustomer.id : null,
    processedAt: order.processed_at ? new Date(order.processed_at)
      : order.created_at ? new Date(order.created_at) : null,
    currency: order.currency ?? null,
    financialStatus: order.financial_status ?? null,
    fulfillmentStatus: order.fulfillment_status ?? null,
    subtotal: toNumber(order.subtotal_price),
    total: toNumber(order.total_price),
    taxes: toNumber(order.total_tax),
    discounts: toNumber(order.total_discounts),
    shipping,
    tags: parseShopifyTags(order.tags),
  };

  const ord = await prisma.order.upsert({
    where: { companyId_shopifyOrderId: { companyId, shopifyOrderId: orderId } },
    create: { companyId, shopifyOrderId: orderId, ...common },
    update: { ...common },
  });

  // Recreate line items
  await prisma.orderLineItem.deleteMany({ where: { orderId: ord.id } });

  const itemsData = (order.line_items || []).map((li: any) => {
    const qty = Number(li.quantity ?? 0);
    const unit = toNumber(li.price);
    return {
      companyId,
      orderId: ord.id,
      shopifyLineItemId: li.id ? String(li.id) : null,
      productId: li.product_id ? String(li.product_id) : null,
      productTitle: li.title ?? null,
      variantId: li.variant_id ? String(li.variant_id) : null,
      variantTitle: li.variant_title ?? null,
      sku: li.sku ?? null,
      productVendor: li.vendor ?? null,
      quantity: qty,
      price: unit,
      total: unit != null ? (qty ? unit * qty : unit) : null,
    };
  });

  if (itemsData.length) await prisma.orderLineItem.createMany({ data: itemsData });

  // Auto-advance pipeline stage based on order value (forward-only)
  if (linkedCustomer) {
    try {
      const total = toNumber(order.total_price) ?? 0;
      const newStage = resolveStageAfterOrder(linkedCustomer.stage as any, total);
      if (newStage) {
        await prisma.customer.update({
          where: { id: linkedCustomer.id },
          data: { stage: newStage as any },
        });
      }
    } catch (e) {
      console.error("Auto-advance stage from order failed:", e);
    }
  }

  return ord;
}

/** ───────────────── Outbound push (CRM → Shopify) ───────────────── */
async function tagForSalesRepName(companyId: string, repName: string): Promise<string> {
  const rep = await prisma.salesRep.findFirst({ where: { companyId, name: repName }, select: { id: true, name: true } });
  if (!rep) return repName;
  const rule = await prisma.salesRepTagRule.findFirst({ where: { companyId, salesRepId: rep.id }, select: { tag: true } });
  return (rule?.tag?.trim()) || rep.name;
}
async function allRepTagsToStripLower(companyId: string): Promise<Set<string>> {
  const [rules, reps] = await Promise.all([
    prisma.salesRepTagRule.findMany({ where: { companyId }, select: { tag: true } }),
    prisma.salesRep.findMany({ where: { companyId }, select: { name: true } }),
  ]);
  const s = new Set<string>();
  for (const r of rules) if (r.tag) s.add(r.tag.toLowerCase().trim());
  for (const r of reps) if (r.name) s.add(r.name.toLowerCase().trim());
  return s;
}
async function fetchShopifyCustomerTags(companyId: string, shopifyId: string): Promise<string[]> {
  const res = await shopifyRest(companyId, `/customers/${shopifyId}.json`, { method: "GET" });
  if (!res.ok) return [];
  const json = await res.json();
  return parseShopifyTags(json?.customer?.tags);
}

export async function pushCustomerToShopifyById(companyId: string, crmCustomerId: string) {
  const c = await prisma.customer.findFirst({ where: { id: crmCustomerId, companyId } });
  if (!c) return;

  const parts = (c.customerName || "").trim().split(/\s+/);
  const first_name = parts[0] || "";
  const last_name = parts.slice(1).join(" ") || "";

  const baseAddress = {
    default: true,
    company: c.salonName || undefined,
    address1: c.addressLine1 || undefined,
    address2: c.addressLine2 || undefined,
    city: c.town || undefined,
    province: c.county || undefined,
    country: c.country || undefined,
    zip: c.postCode || undefined,
  };

  const currentRep = (c.salesRep || "").trim();
  const repTag = currentRep ? (await tagForSalesRepName(companyId, currentRep)) : null;

  let existingShopifyId = c.shopifyCustomerId || null;
  let existingTags: string[] = [];
  if (existingShopifyId) {
    try { existingTags = await fetchShopifyCustomerTags(companyId, existingShopifyId); } catch { existingTags = []; }
  }

  const repUniverse = await allRepTagsToStripLower(companyId);
  const kept = existingTags.filter(t => !repUniverse.has(t.toLowerCase().trim()));
  const newTags = repTag ? [...kept, repTag] : kept;

  const payload: any = {
    customer: {
      email: c.customerEmailAddress || undefined,
      phone: c.customerTelephone || undefined,
      first_name,
      last_name,
      addresses: [baseAddress],
      tags: tagsToString(newTags),
    },
  };

  if (!existingShopifyId) {
    const res = await shopifyRest(companyId, `/customers.json`, { method: "POST", body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(`Shopify create failed: ${res.status} ${await res.text().catch(()=>"")}`);
    const json = await res.json();
    const shopifyId = String(json?.customer?.id ?? "");
    if (shopifyId) {
      await prisma.customer.update({
        where: { id: c.id },
        data: {
          shopifyCustomerId: shopifyId,
          shopifyLastSyncedAt: new Date(),
          shopifyTags: parseShopifyTags(json?.customer?.tags),
        },
      });
    }
  } else {
    const res = await shopifyRest(companyId, `/customers/${existingShopifyId}.json`, {
      method: "PUT",
      body: JSON.stringify({ customer: { id: Number(existingShopifyId), ...payload.customer } }),
    });
    if (!res.ok) throw new Error(`Shopify update failed: ${res.status} ${await res.text().catch(()=>"")}`);
    const json = await res.json();
    await prisma.customer.update({
      where: { id: c.id },
      data: {
        shopifyLastSyncedAt: new Date(),
        shopifyTags: parseShopifyTags(json?.customer?.tags),
      },
    });
  }
}

/* ────────────────────────────────────────────────────────────────
   Product Search (Admin GraphQL) for "Create Order"
   ──────────────────────────────────────────────────────────────── */

export type ShopifySearchVariant = {
  productGid: string;
  productId: string | null;
  productTitle: string;
  vendor: string | null;
  imageUrl: string | null;
  status: string | null;

  variantGid: string;
  variantId: string | null;
  variantTitle: string;
  sku: string | null;
  barcode: string | null;

  priceAmount: string | null;
  currencyCode: string | null;

  unitCostAmount?: string | null;
  unitCostCurrencyCode?: string | null;

  availableForSale: boolean | null;
  inventoryQuantity: number | null;
};

function buildProductQueryString(term: string): string {
  const t = term.replace(/"/g, '\\"').trim();
  if (!t) return "";
  return `title:*${t}* OR sku:*${t}* OR vendor:*${t}*`;
}

export async function searchShopifyCatalog(companyId: string, term: string, first = 15): Promise<ShopifySearchVariant[]> {
  const q = buildProductQueryString(term);
  if (!q) return [];

  const query = `
    query SearchProducts($q: String!, $first: Int!) {
      products(first: $first, query: $q) {
        edges {
          node {
            id
            title
            vendor
            status
            images(first: 1) { edges { node { url } } }
            variants(first: 50) {
              edges {
                node {
                  id
                  title
                  sku
                  barcode
                  availableForSale
                  inventoryQuantity
                  price { amount currencyCode }
                  inventoryItem {
                    unitCost { amount currencyCode }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  type Gx = {
    products: {
      edges: Array<{
        node: {
          id: string;
          title: string;
          vendor?: string | null;
          status?: string | null;
          images?: { edges: { node: { url: string } }[] } | null;
          variants: {
            edges: Array<{
              node: {
                id: string;
                title: string;
                sku?: string | null;
                barcode?: string | null;
                availableForSale?: boolean | null;
                inventoryQuantity?: number | null;
                price?: { amount: string; currencyCode: string } | null;
                inventoryItem?: { unitCost?: { amount: string; currencyCode: string } | null } | null;
              };
            }>;
          };
        };
      }>;
    };
  };

  const data = await shopifyGraphql<Gx>(companyId, query, { q, first });
  const out: ShopifySearchVariant[] = [];
  for (const pe of data?.products?.edges || []) {
    const p = pe.node;
    const productId = gidToNumericId(p.id);
    const img = p.images?.edges?.[0]?.node?.url || null;

    for (const ve of p.variants?.edges || []) {
      const v = ve.node;
      out.push({
        productGid: p.id,
        productId,
        productTitle: p.title,
        vendor: p.vendor ?? null,
        imageUrl: img,
        status: p.status ?? null,

        variantGid: v.id,
        variantId: gidToNumericId(v.id),
        variantTitle: v.title,
        sku: v.sku ?? null,
        barcode: v.barcode ?? null,

        priceAmount: v.price?.amount ?? null,
        currencyCode: v.price?.currencyCode ?? null,

        unitCostAmount: v.inventoryItem?.unitCost?.amount ?? null,
        unitCostCurrencyCode: v.inventoryItem?.unitCost?.currencyCode ?? null,

        availableForSale: v.availableForSale ?? null,
        inventoryQuantity: typeof v.inventoryQuantity === "number" ? v.inventoryQuantity : null,
      });
    }
  }
  return out;
}

function normalizeTagsToString(input?: string | string[] | null): string | undefined {
  if (input == null) return undefined;
  if (Array.isArray(input)) return tagsToString(input);
  const s = String(input).trim();
  if (!s) return undefined;
  if (s.startsWith("[") && s.endsWith("]")) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return tagsToString(arr.map(String));
    } catch {}
  }
  return s;
}

export async function createDraftOrderForCustomer(
  companyId: string,
  crmCustomerId: string,
  items: Array<{ variantId: string; quantity: number }>,
  note?: string,
  tags?: string | string[],
) {
  const customer = await prisma.customer.findFirst({
    where: { id: crmCustomerId, companyId },
    select: { shopifyCustomerId: true, customerEmailAddress: true, salonName: true, customerName: true },
  });
  if (!customer) throw new Error("Customer not found");
  if (!customer.shopifyCustomerId) throw new Error("This customer is not linked to a Shopify customer");

  const line_items = items.map((li) => ({
    variant_id: Number(li.variantId),
    quantity: li.quantity,
  }));

  const provided = normalizeTagsToString(tags);
  const defaults = normalizeTagsToString(DEFAULT_DRAFT_TAG);
  const combined = tagsToString([
    ...parseShopifyTags(provided || ""),
    ...parseShopifyTags(defaults || ""),
  ]);

  const payload: any = {
    draft_order: {
      customer: { id: Number(customer.shopifyCustomerId) },
      line_items,
      note: note || undefined,
      use_customer_default_address: true,
      note_attributes: [{ name: "Source", value: "CRM" }],
    },
  };

  if (combined) payload.draft_order.tags = combined;
  if (payload?.draft_order?.tags && Array.isArray(payload.draft_order.tags)) {
    payload.draft_order.tags = tagsToString(payload.draft_order.tags);
  }

  const res = await shopifyRest(companyId, `/draft_orders.json`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Draft order create failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  return json?.draft_order || null;
}

/* ──────────────────────────────────────────────────────────────
   Cost-per-item helpers
   ────────────────────────────────────────────────────────────── */

export async function fetchVariantUnitCosts(
  companyId: string,
  variantNumericIds: Array<string | number>
): Promise<Map<string, { unitCost: number | null; currency: string | null }>> {
  const ids = (variantNumericIds || []).map(v => String(v)).filter(Boolean);
  const out = new Map<string, { unitCost: number | null; currency: string | null }>();
  if (!ids.length) return out;

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));

  const query = `
    query VariantCosts($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on ProductVariant {
          id
          inventoryItem {
            unitCost { amount currencyCode }
          }
        }
      }
    }
  `;

  for (const bucket of chunks) {
    const variables = { ids: bucket.map(numericVariantIdToGid) };
    const data = await shopifyGraphql<{
      nodes: Array<
        | { id: string; inventoryItem?: { unitCost?: { amount: string; currencyCode: string } | null } | null }
        | null
      >;
    }>(companyId, query, variables);

    for (const node of data?.nodes || []) {
      if (!node || !("id" in node) || !node.id) continue;
      const numeric = gidToNumericId(node.id);
      const amt = node?.inventoryItem?.unitCost?.amount ?? null;
      const cur = node?.inventoryItem?.unitCost?.currencyCode ?? null;
      const unitCost = amt != null ? Number(amt) : null;
      if (numeric) out.set(numeric, { unitCost, currency: cur });
    }
  }

  return out;
}

export async function fetchLineCostsForOrderPayload(companyId: string, order: any) {
  const lines = Array.isArray(order?.line_items) ? order.line_items : [];
  const varIds: string[] = [];
  const keyByLineId: Record<string, string> = {};

  for (const li of lines) {
    const vid = li?.variant_id != null ? String(li.variant_id) : "";
    const lid = li?.id != null ? String(li.id) : "";
    if (vid) varIds.push(vid);
    if (lid && vid) keyByLineId[lid] = vid;
  }

  const costMap = await fetchVariantUnitCosts(companyId, varIds);
  const result: Record<string, { unitCost: number | null; extendedCost: number | null }> = {};
  let totalCost = 0;

  for (const li of lines) {
    const lid = li?.id != null ? String(li.id) : "";
    const vid = keyByLineId[lid];
    const entry = vid ? costMap.get(vid) : undefined;
    const unit = entry ? entry.unitCost : null;
    const qty = Number(li?.quantity ?? 0) || 0;
    const ext = unit != null ? unit * qty : null;
    result[lid] = { unitCost: unit, extendedCost: ext };
    if (ext != null) totalCost += ext;
  }

  return { lines: result, totalCost };
}

export async function fetchVariantCostsOnce(companyId: string, variantNumericIds: Array<string | number>) {
  return fetchVariantUnitCosts(companyId, variantNumericIds);
}

/* ──────────────────────────────────────────────────────────────
   Variant ID resolution by SKU (for reports/backfills)
   ────────────────────────────────────────────────────────────── */

export async function fetchVariantIdsBySkus(
  companyId: string,
  skus: string[],
  chunkSize = 25
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!skus || skus.length === 0) return out;

  const esc = (s: string) => String(s).replace(/"/g, '\\"');

  for (let i = 0; i < skus.length; i += chunkSize) {
    const batch = skus.slice(i, i + chunkSize);
    const queryString = batch.map((s) => `sku:"${esc(s)}"`).join(" OR ");

    const query = `
      query VariantsBySku($q: String!, $first: Int!) {
        productVariants(first: $first, query: $q) {
          edges {
            node {
              id
              sku
              legacyResourceId
            }
          }
        }
      }
    `;

    type Gx = {
      productVariants: {
        edges: Array<{
          node: {
            id: string;
            sku: string | null;
            legacyResourceId?: string | null;
          };
        }>;
      };
    };

    const data = await shopifyGraphql<Gx>(companyId, query, { q: queryString, first: 250 });

    for (const edge of data?.productVariants?.edges || []) {
      const sku = (edge.node.sku || "").trim();
      if (!sku) continue;
      const legacy = edge.node.legacyResourceId || gidToNumericId(edge.node.id);
      if (!legacy) continue;
      if (!out.has(sku)) out.set(sku, String(legacy));
    }
  }

  return out;
}
