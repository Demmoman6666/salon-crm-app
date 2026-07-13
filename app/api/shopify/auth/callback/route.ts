// app/api/shopify/auth/callback/route.ts — OAuth callback.
// Verifies HMAC + state, exchanges the code, upserts the Company,
// registers webhooks, then sends the merchant to onboarding.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  verifyOAuthHmac,
  exchangeCodeForToken,
  isValidShopDomain,
  registerWebhooks,
} from "@/lib/shopify-app";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams;
  const shop = (q.get("shop") || "").trim().toLowerCase();
  const code = q.get("code") || "";
  const state = q.get("state") || "";

  if (!isValidShopDomain(shop) || !code) {
    return NextResponse.json({ error: "Invalid callback parameters" }, { status: 400 });
  }
  if (!verifyOAuthHmac(q)) {
    return NextResponse.json({ error: "HMAC verification failed" }, { status: 401 });
  }
  const expectedState = cookies().get("shopify_oauth_state")?.value;
  if (!expectedState || expectedState !== state) {
    return NextResponse.json({ error: "State mismatch" }, { status: 401 });
  }

  const { access_token, scope, refresh_token, expires_in } = await exchangeCodeForToken(shop, code);
  const tokenExpiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null;

  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const company = await prisma.company.upsert({
    where: { shopDomain: shop },
    create: {
      name: shop.replace(".myshopify.com", ""),
      shopDomain: shop,
      shopifyAccessToken: access_token,
      shopifyRefreshToken: refresh_token ?? null,
      shopifyTokenExpiresAt: tokenExpiresAt,
      shopifyScopes: scope,
      plan: "trial",
      trialEndsAt,
    },
    update: {
      shopifyAccessToken: access_token,
      shopifyRefreshToken: refresh_token ?? null,
      shopifyTokenExpiresAt: tokenExpiresAt,
      shopifyScopes: scope,
      uninstalledAt: null,
    },
  });

  // Register webhooks (non-fatal if some fail — retried on next auth)
  try {
    await registerWebhooks(company.id);
  } catch (e) {
    console.error("[install] webhook registration failed:", e);
  }

  const dest = company.onboardedAt ? "/" : `/onboarding?companyId=${company.id}`;
  const res = NextResponse.redirect(new URL(dest, url.origin));
  res.cookies.delete("shopify_oauth_state");
  return res;
}
