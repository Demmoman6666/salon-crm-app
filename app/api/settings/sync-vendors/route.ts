// app/api/settings/sync-vendors/route.ts
// Pulls distinct vendors from the company's Shopify catalogue and creates any
// missing StockedBrand rows (unticked by default). Existing brands keep their toggles.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, TenantError } from "@/lib/tenant";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { shopifyGraphql } from "@/lib/shopify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const t = await requireTenant();
    const me = await getCurrentUser();
    if (!isAdmin(me)) return NextResponse.json({ error: "Admin only" }, { status: 403 });

    // Pull distinct vendors from Shopify (paginated)
    const query = `
      query Vendors($cursor: String) {
        products(first: 250, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges { node { vendor } }
        }
      }
    `;

    const vendorSet = new Set<string>();
    let cursor: string | null = null;
    let guard = 0;
    do {
      const data: any = await shopifyGraphql(t.companyId, query, { cursor });
      const conn = data?.products;
      for (const e of conn?.edges || []) {
        const v = (e.node?.vendor || "").trim();
        if (v) vendorSet.add(v);
      }
      cursor = conn?.pageInfo?.hasNextPage ? conn.pageInfo.endCursor : null;
      guard++;
    } while (cursor && guard < 20);

    const vendors = Array.from(vendorSet).sort((a, b) => a.localeCompare(b));

    // Which already exist?
    const existing = await prisma.stockedBrand.findMany({
      where: { companyId: t.companyId },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((b) => b.name));

    const toCreate = vendors.filter((v) => !existingNames.has(v));

    if (toCreate.length) {
      await prisma.stockedBrand.createMany({
        data: toCreate.map((name) => ({
          companyId: t.companyId,
          name,
          // defaults: visibleInCallLog=false, visibleInReports=false (unticked)
        })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({
      ok: true,
      vendorsFound: vendors.length,
      added: toCreate.length,
      alreadyPresent: vendors.length - toCreate.length,
    });
  } catch (e: any) {
    const status = e instanceof TenantError ? e.status : 500;
    return NextResponse.json({ error: e.message || "Sync failed" }, { status });
  }
}
