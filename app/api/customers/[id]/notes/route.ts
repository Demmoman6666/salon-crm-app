// app/api/customers/[id]/notes/route.ts
export const runtime = "nodejs";

import { requireTenant } from "@/lib/tenant";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const t = await requireTenant();
  const { text, staff } = await req.json();
  if (!text) return new NextResponse("Missing text", { status: 400 });

  const note = await prisma.note.create({
    data: {
        companyId: t.companyId,
      customerId: params.id,
      text,
      staff: staff || null,
    },
  });

  return NextResponse.json(note, { status: 201 });
}
