import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { requireTenant, TenantError } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const t = await requireTenant();
    const settings = await prisma.cycleSettings.findUnique({ where: { companyId: t.companyId } });
    return NextResponse.json({ cycleStartDate: settings?.cycleStartDate?.toISOString().slice(0, 10) || null });
  } catch (e: any) {
    const status = e instanceof TenantError ? e.status : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const t = await requireTenant();
    const me = await getCurrentUser();
    if (!isAdmin(me)) return NextResponse.json({ error: "Admin only" }, { status: 403 });
    const { cycleStartDate } = await req.json();
    if (!cycleStartDate) return NextResponse.json({ error: "cycleStartDate required" }, { status: 400 });
    const settings = await prisma.cycleSettings.upsert({
      where: { companyId: t.companyId },
      create: { companyId: t.companyId, cycleStartDate: new Date(cycleStartDate) },
      update: { cycleStartDate: new Date(cycleStartDate) },
    });
    return NextResponse.json({ cycleStartDate: settings.cycleStartDate.toISOString().slice(0, 10) });
  } catch (e: any) {
    const status = e instanceof TenantError ? e.status : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}
