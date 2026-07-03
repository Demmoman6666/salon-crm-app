import { requireTenant } from "@/lib/tenant";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const t = await requireTenant();
  const rows = await prisma.stockedBrand.findMany({
    where: { companyId: t.companyId, visibleInCallLog: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return NextResponse.json(rows);
}
