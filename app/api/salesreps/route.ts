// app/api/salesreps/route.ts
import { requireTenant } from "@/lib/tenant";
import { canAddRep } from "@/lib/entitlements";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const t = await requireTenant();
  const reps = await prisma.salesRep.findMany({ where: { companyId: t.companyId }, orderBy: { name: "asc" } });
  return NextResponse.json(reps);
}

export async function POST(req: Request) {
  const t = await requireTenant();
  const me = await getCurrentUser();
  if (!isAdmin(me)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    const { name, email, phone, territory } = await req.json();
    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Enforce plan rep limit
    const gate = await canAddRep();
    if (!gate.ok) {
      return NextResponse.json(
        {
          error: `You've reached your plan's limit of ${gate.limit} sales reps. Upgrade to ${gate.upgradeTo} to add more.`,
          upgradeTo: gate.upgradeTo,
          code: "REP_LIMIT",
        },
        { status: 402 }
      );
    }

    const rep = await prisma.salesRep.create({
      data: {
        companyId: t.companyId,
        name: String(name).trim(),
        email: email ? String(email).trim() : null,
        phone: phone ? String(phone).trim() : null,
        territory: territory ? String(territory).trim() : null,
      },
    });
    return NextResponse.json(rep, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Sales rep already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create sales rep" }, { status: 500 });
  }
}
