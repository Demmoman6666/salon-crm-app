import { requireTenant } from "@/lib/tenant";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const t = await requireTenant();
  const educators = await (prisma as any).educator.findMany({
    orderBy: { name: "asc" },
    where: { companyId: t.companyId, active: true },
  });
  return NextResponse.json(educators);
}

export async function POST(req: Request) {
  const t = await requireTenant();
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, email, phone, specialisms } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const educator = await (prisma as any).educator.create({
    data: {
      companyId: t.companyId,
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      specialisms: Array.isArray(specialisms) ? specialisms : [],
      active: true,
    },
  });
  return NextResponse.json(educator);
}
