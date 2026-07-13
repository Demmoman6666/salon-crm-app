// lib/shopify-app.ts
// Shopify App Store plumbing: OAuth install flow, HMAC verification,
// Billing API, webhook registration, and per-company Admin API access.

import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || "2025-01";

const API_KEY = process.env.SHOPIFY_API_KEY || "";
const API_SECRET = process.env.SHOPIFY_API_SECRET || "";
const APP_URL = (process.env.APP_URL || "").replace(/\/$/, "");

export const OAUTH_SCOPES = [
  "read_customers",
  "write_customers",
  "read_orders",
  "read_products",
  "write_draft_orders",
].join(",");

// ---------- OAuth ----------

export function isValidShopDomain(shop: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/.test(shop);
}

export function buildInstallUrl(shop: string, state: string): string {
  const redirectUri = `${APP_URL}/api/shopify/auth/callback`;
  const params = new URLSearchParams({
    client_id: API_KEY,
    scope: OAUTH_SCOPES,
    redirect_uri: redirectUri,
    state,
  });
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

/** Verify the HMAC on OAuth callback / app-load query strings. */
export function verifyOAuthHmac(query: URLSearchParams): boolean {
  const hmac = query.get("hmac");
  if (!hmac || !API_SECRET) return false;
  const pairs: string[] = [];
  const sorted = Array.from(query.keys()).filter(k => k !== "hmac" && k !== "signature").sort();
  for (const k of sorted) pairs.push(`${k}=${query.get(k)}`);
  const digest = crypto.createHmac("sha256", API_SECRET).update(pairs.join("&")).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(hmac, "hex"));
  } catch {
    return false;
  }
}

/** Exchange the OAuth code for an EXPIRING offline access token (+ refresh token). */
export async function exchangeCodeForToken(shop: string, code: string): Promise<{
  access_token: string;
  scope: string;
  refresh_token?: string;
  expires_in?: number;
}> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    // expiring: 1 (NOT true) -> Shopify returns an expiring offline token + refresh_token.
    // Non-expiring tokens are rejected by the Admin API for public apps.
    body: JSON.stringify({ client_id: API_KEY, client_secret: API_SECRET, code, expiring: 1 }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Use a stored refresh token to mint a fresh access/refresh token pair. */
export async function refreshAccessToken(shop: string, refreshToken: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: API_KEY,
      client_secret: API_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// ---------- Webhook HMAC (raw body) ----------

export function verifyWebhookHmac(rawBody: string, hmacHeader: string | null): boolean {
  if (!hmacHeader || !API_SECRET) return false;
  const digest = crypto.createHmac("sha256", API_SECRET).update(rawBody, "utf8").digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

// ---------- Per-company Admin API ----------

export async function getCompanyShopifyCreds(companyId: string): Promise<{ shopDomain: string; token: string }> {
  const c = await prisma.company.findUnique({
    where: { id: companyId },
    select: { shopDomain: true, shopifyAccessToken: true },
  });
  if (!c?.shopDomain || !c.shopifyAccessToken) {
    throw new Error("Shopify is not connected for this company");
  }
  return { shopDomain: c.shopDomain, token: c.shopifyAccessToken };
}

export async function shopifyRest(companyId: string, path: string, init?: RequestInit) {
  const { shopDomain, token } = await getCompanyShopifyCreds(companyId);
  const url = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}${path.startsWith("/") ? path : "/" + path}`;
  return fetch(url, {
    ...init,
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
}

export async function shopifyGraphql(companyId: string, query: string, variables?: Record<string, any>) {
  const { shopDomain, token } = await getCompanyShopifyCreds(companyId);
  const res = await fetch(`https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: variables || {} }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) {
    throw new Error("Shopify GraphQL error: " + JSON.stringify(json.errors || json));
  }
  return json.data;
}

// ---------- Webhook registration (on install) ----------

const WEBHOOK_TOPICS = [
  "orders/create",
  "orders/updated",
  "orders/paid",
  "orders/fulfilled",
  "refunds/create",
  "customers/create",
  "customers/update",
  "app/uninstalled",
];

export async function registerWebhooks(companyId: string) {
  const address = `${APP_URL}/api/shopify/webhooks`;
  const results: Array<{ topic: string; ok: boolean }> = [];
  for (const topic of WEBHOOK_TOPICS) {
    try {
      const res = await shopifyRest(companyId, "/webhooks.json", {
        method: "POST",
        body: JSON.stringify({ webhook: { topic, address, format: "json" } }),
      });
      // 422 usually means already registered — treat as ok
      results.push({ topic, ok: res.ok || res.status === 422 });
    } catch {
      results.push({ topic, ok: false });
    }
  }
  return results;
}

// ---------- Billing (Shopify Billing API via GraphQL) ----------

export const PLANS: Record<string, { name: string; amount: number; trialDays: number }> = {
  starter: { name: "Starter", amount: 49, trialDays: 14 },
  growth: { name: "Growth", amount: 99, trialDays: 14 },
  pro: { name: "Pro", amount: 199, trialDays: 14 },
};

export async function createSubscription(companyId: string, planKey: string): Promise<{ confirmationUrl: string; subscriptionId: string }> {
  const plan = PLANS[planKey];
  if (!plan) throw new Error("Unknown plan: " + planKey);

  const returnUrl = `${APP_URL}/api/billing/callback?companyId=${encodeURIComponent(companyId)}&plan=${encodeURIComponent(planKey)}`;
  const isTest = process.env.SHOPIFY_BILLING_TEST === "1";

  const data = await shopifyGraphql(
    companyId,
    `mutation AppSubscribe($name: String!, $returnUrl: URL!, $trialDays: Int!, $test: Boolean!, $lineItems: [AppSubscriptionLineItemInput!]!) {
      appSubscriptionCreate(name: $name, returnUrl: $returnUrl, trialDays: $trialDays, test: $test, lineItems: $lineItems) {
        userErrors { field message }
        confirmationUrl
        appSubscription { id }
      }
    }`,
    {
      name: `Salon CRM — ${plan.name}`,
      returnUrl,
      trialDays: plan.trialDays,
      test: isTest,
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: { amount: plan.amount, currencyCode: "USD" },
              interval: "EVERY_30_DAYS",
            },
          },
        },
      ],
    }
  );

  const payload = data?.appSubscriptionCreate;
  const err = payload?.userErrors?.[0];
  if (err) throw new Error(err.message);
  return { confirmationUrl: payload.confirmationUrl, subscriptionId: payload.appSubscription?.id };
}
