// app/api/sales-reps/route.ts
import { requireTenant } from "@/lib/tenant";
import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type UiRep = { id: string; name: string; email?: string | null };

export async function GET(req: NextRequest) {
  const t = await requireTenant();
  const mode = (req.nextUrl?.searchParams.get("mode") || "canonical").toLowerCase();

  try {
    // ---- Canonical only (default) ----
    if (mode !== "all") {
      const reps = await prisma.salesRep.findMany({
        where: { companyId: t.companyId },
select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      });
      return NextResponse.json(reps as UiRep[]);
    }

    // ---- Aggregated view (only if ?mode=all) ----
    const [tbl, users, staffRows, custRows] = await Promise.all([
      prisma.salesRep.findMany({ where: { companyId: t.companyId },
select: { id: true, name: true, email: true } }),
      prisma.user.findMany({
        where: { companyId: t.companyId, isActive: true, role: { in: [Role.REP, Role.MANAGER, Role.ADMIN] } },
        select: { fullName: true, email: true },
      }),
      prisma.callLog.findMany({ where: { companyId: t.companyId, staff: { not: null } }, select: { staff: true }, distinct: ["staff"] }),
      prisma.customer.findMany({ where: { companyId: t.companyId, salesRep: { not: null } }, select: { salesRep: true }, distinct: ["salesRep"] }),
    ]);

    const canonicalByName = new Map(
      tbl.map(r => [r.name.trim().toLowerCase(), r])
    );

    const names = [
      ...tbl.map(r => r.name),
      ...users.map(u => u.fullName!).filter(Boolean),
      ...staffRows.map(s => s.staff!).filter(Boolean),
      ...custRows.map(c => c.salesRep!).filter(Boolean),
    ];

    const norm = (s: string) => s.trim().replace(/\s+/g, " ");
    const seen = new Set<string>();
    const merged: UiRep[] = [];

    for (const name of names) {
      const n = norm(name);
      if (!n) continue;
      const key = n.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const canon = canonicalByName.get(key);
      merged.push({
        id: canon?.id ?? n,   // stable fallback id for UI lists
        name: canon?.name ?? n,
        email: canon?.email ?? null,
      });
    }

    merged.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return NextResponse.json(merged);
  } catch (err) {
    console.error("GET /api/sales-reps failed:", err);
    return NextResponse.json([], { status: 200 }); // fail-soft with empty list
  }
}
