// app/api/shopify/catalog/route.ts
// Returns the company's Shopify catalogue grouped by vendor, with variant prices.
// Used by the Profit Calculator so vendor -> product -> price cascade uses real data.
import { NextResponse } from "next/server";
import { requireTenant, TenantError } from "@/lib/tenant";
import { shopifyGraphql } from "@/lib/shopify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Variant = { id: string; title: string; price: number; sku: string | null };
type Product = { id: string; title: string; vendor: string; variants: Variant[] };

export async function GET() {
  try {
    const t = await requireTenant();

    const query = `
      query Catalogue($cursor: String) {
        products(first: 100, after: $cursor, query: "status:active") {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id
              title
              vendor
              variants(first: 20) {
                edges { node { id title price sku } }
              }
            }
          }
        }
      }
    `;

    const products: Product[] = [];
    let cursor: string | null = null;
    let guard = 0;

    do {
      const data: any = await shopifyGraphql(t.companyId, query, { cursor });
      const conn = data?.products;
      for (const pe of conn?.edges || []) {
        const p = pe.node;
        products.push({
          id: p.id,
          title: p.title,
          vendor: (p.vendor || "").trim() || "UnVendored",
          variants: (p.variants?.edges || []).map((ve: any) => ({
            id: ve.node.id,
            title: ve.node.title,
            price: Number(ve.node.price) || 0,
            sku: ve.node.sku || null,
          })),
        });
      }
      cursor = conn?.pageInfo?.hasNextPage ? conn.pageInfo.endCursor : null;
      guard++;
    } while (cursor && guard < 20);

    // Group by vendor
    const byVendor = new Map<string, Product[]>();
    for (const p of products) {
      if (!byVendor.has(p.vendor)) byVendor.set(p.vendor, []);
      byVendor.get(p.vendor)!.push(p);
    }

    const vendors = Array.from(byVendor.entries())
      .map(([name, prods]) => ({
        name,
        products: prods.sort((a, b) => a.title.localeCompare(b.title)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ vendors });
  } catch (e: any) {
    const status = e instanceof TenantError ? e.status : 500;
    return NextResponse.json({ error: e.message || "Failed to load catalogue" }, { status });
  }
}
