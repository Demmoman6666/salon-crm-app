// app/api/shopify/auth/route.ts — Install entry point.
// Shopify (or a merchant) hits /api/shopify/auth?shop=store.myshopify.com
import { NextResponse } from "next/server";
import crypto from "crypto";
import { buildInstallUrl, isValidShopDomain } from "@/lib/shopify-app";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const shop = (searchParams.get("shop") || "").trim().toLowerCase();

  if (!isValidShopDomain(shop)) {
    return NextResponse.json({ error: "Invalid or missing shop parameter" }, { status: 400 });
  }

  // CSRF state — echoed back on the callback and verified there.
  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildInstallUrl(shop, state));
  res.cookies.set("shopify_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
