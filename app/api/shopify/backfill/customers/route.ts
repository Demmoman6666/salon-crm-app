// app/api/shopify/backfill/customers/route.ts
import { requireTenant } from "@/lib/tenant";
import { NextResponse } from "next/server";
import { shopifyRest, upsertCustomerFromShopify } from "@/lib/shopify";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const t = await requireTenant();
  const url = new URL(req.url);
  const pageInfo = url.searchParams.get("page_info");

  const query = pageInfo ? `?limit=250&page_info=${encodeURIComponent(pageInfo)}` : "?limit=250";
  const res = await shopifyRest(t.companyId, `/customers.json${query}`, { method: "GET" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `Shopify customers read failed: ${res.status}`, detail: text.slice(0, 500) },
      { status: 502 }
    );
  }
  const json = await res.json();

  for (const c of json.customers || []) {
    await upsertCustomerFromShopify(t.companyId, c);
  }

  // Relay pagination cursor (Link header)
  const link = res.headers.get("link") || "";
  // e.g. <https://.../customers.json?limit=250&page_info=XYZ>; rel="next"
  const match = link.match(/<[^>]*page_info=([^>]+)>;\s*rel="next"/i);
  const nextPageInfo = match ? match[1] : null;

  return NextResponse.json({ imported: (json.customers || []).length, nextPageInfo });
}
