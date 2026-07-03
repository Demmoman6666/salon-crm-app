// app/api/onboarding/route.ts — Save onboarding wizard data.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export async function POST(req: Request) {
  const body = await req.json();
  const { companyId, companyName, adminName, adminEmail, adminPassword, brands, reps } = body;

  if (!companyId || !companyName?.trim() || !adminName?.trim() || !adminEmail?.trim() || !adminPassword) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  if (company.onboardedAt) return NextResponse.json({ error: "Already onboarded" }, { status: 409 });

  const email = String(adminEmail).trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

  const user = await prisma.$transaction(async (tx) => {
    await tx.company.update({
      where: { id: companyId },
      data: { name: companyName.trim(), onboardedAt: new Date() },
    });

    const u = await tx.user.create({
      data: {
        companyId,
        fullName: adminName.trim(),
        email,
        passwordHash: hashPassword(adminPassword),
        role: "ADMIN",
      },
    });

    const brandNames: string[] = Array.isArray(brands) ? brands.map((b: any) => String(b).trim()).filter(Boolean) : [];
    for (const name of brandNames) {
      await tx.stockedBrand.create({
        data: { companyId, name, visibleInCallLog: true, visibleInReports: true },
      }).catch(() => {});
    }

    const repNames: string[] = Array.isArray(reps) ? reps.map((r: any) => String(r).trim()).filter(Boolean) : [];
    for (const name of repNames) {
      await tx.salesRep.create({ data: { companyId, name } }).catch(() => {});
    }

    return u;
  });

  // Log them straight in
  const token = createSessionToken(user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set("sbp_session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
