import { requireTenant } from "@/lib/tenant";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const t = await requireTenant();
  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get('customerId') ?? undefined;

  const visits = await prisma.visit.findMany({
    where: customerId ? { companyId: t.companyId, customerId } : { companyId: t.companyId },
    orderBy: { date: 'desc' },
    include: { customer: true },
  });

  return NextResponse.json(visits);
}
