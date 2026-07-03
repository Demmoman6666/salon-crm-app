// app/api/settings/company/route.ts — read/write per-company settings (JSON blob)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, TenantError } from "@/lib/tenant";
import { getCurrentUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const t = await requireTenant();
    const company = await prisma.company.findUnique({
      where: { id: t.companyId },
      select: { settings: true },
    });
    const settings = (company?.settings as any) || {};
    return NextResponse.json({
      autoPushCustomers: settings.autoPushCustomers === true,
    });
  } catch (e: any) {
    const status = e instanceof TenantError ? e.status : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

export async function PATCH(req: Request) {
  try {
    const t = await requireTenant();
    const me = await getCurrentUser();
    if (!isAdmin(me)) return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const body = await req.json();
    const company = await prisma.company.findUnique({
      where: { id: t.companyId },
      select: { settings: true },
    });
    const current = (company?.settings as any) || {};

    // Only update known keys
    const next = { ...current };
    if (typeof body.autoPushCustomers === "boolean") {
      next.autoPushCustomers = body.autoPushCustomers;
    }

    await prisma.company.update({
      where: { id: t.companyId },
      data: { settings: next },
    });

    return NextResponse.json({ ok: true, autoPushCustomers: next.autoPushCustomers === true });
  } catch (e: any) {
    const status = e instanceof TenantError ? e.status : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}
