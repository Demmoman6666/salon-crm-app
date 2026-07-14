// app/api/reps/[id]/route.ts
import { requireTenant } from "@/lib/tenant";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const t = await requireTenant();
  try {
    const rep = await prisma.salesRep.findFirst({ where: { companyId: t.companyId, id: params.id } });
    if (!rep) return NextResponse.json({ error: "Rep not found" }, { status: 404 });

    const [totalCustomers, customersByStage, recentCustomers] = await Promise.all([
      prisma.customer.count({ where: { companyId: t.companyId, salesRepId: rep.id } }),
      prisma.customer.groupBy({ by: ["stage"], where: { salesRepId: rep.id }, _count: { _all: true } }),
      prisma.customer.findMany({
        where: { companyId: t.companyId, salesRepId: rep.id },
        select: { id: true, salonName: true, town: true, stage: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
    ]);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [recentCalls, totalCalls] = await Promise.all([
      prisma.callLog.findMany({
        where: { companyId: t.companyId,
          OR: [{ repId: rep.id }, { staff: { equals: rep.name, mode: "insensitive" } }],
          createdAt: { gte: thirtyDaysAgo },
        },
        select: {
          id: true, createdAt: true, callType: true, outcome: true,
          customerName: true, customer: { select: { id: true, salonName: true } },
          durationMinutes: true, followUpRequired: true, followUpAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.callLog.count({
        where: { companyId: t.companyId, OR: [{ repId: rep.id }, { staff: { equals: rep.name, mode: "insensitive" } }] },
      }),
    ]);

    const pendingFollowUps = await prisma.callLog.count({
      where: { companyId: t.companyId,
        OR: [{ repId: rep.id }, { staff: { equals: rep.name, mode: "insensitive" } }],
        followUpRequired: true,
        followUpAt: { lte: new Date() },
      },
    });

    return NextResponse.json({
      rep,
      stats: {
        totalCustomers, totalCalls, pendingFollowUps,
        customersByStage: Object.fromEntries(customersByStage.map((s) => [s.stage, s._count._all])),
      },
      recentCustomers,
      recentCalls,
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
