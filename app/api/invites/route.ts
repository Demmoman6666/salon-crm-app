// app/api/invites/route.ts — create & send a user invitation (admin only)
import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireTenant, TenantError, getCompanyName } from "@/lib/tenant";
import { requireCapability, ForbiddenError } from "@/lib/rbac";
import { sendInviteEmail } from "@/lib/email";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const APP_URL = (process.env.APP_URL || "").replace(/\/$/, "");

export async function POST(req: Request) {
  try {
    await requireCapability("users");
    const t = await requireTenant();

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const fullName = String(body.fullName || "").trim();
    const phone = body.phone ? String(body.phone).trim() : null;
    const roleInput = String(body.role || "REP").toUpperCase();

    if (!email || !fullName) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    const roleMap: Record<string, Role> = {
      ADMIN: Role.ADMIN, MANAGER: Role.MANAGER, REP: Role.REP, VIEWER: Role.VIEWER,
    };
    const role = roleMap[roleInput] ?? Role.REP;

    // Reject if a user with this email already exists in this company
    const existing = await prisma.user.findFirst({
      where: { companyId: t.companyId, email },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
    }

    // Create the invite (7-day expiry). Replace any prior pending invite for this email.
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.invite.deleteMany({
      where: { companyId: t.companyId, email, acceptedAt: null },
    });

    await prisma.invite.create({
      data: { companyId: t.companyId, email, fullName, phone, role, token, expiresAt },
    });

    const companyName = await getCompanyName().catch(() => "your team");
    const inviteUrl = `${APP_URL}/accept-invite?token=${token}`;

    await sendInviteEmail({ to: email, fullName, companyName, inviteUrl });

    return NextResponse.json({ ok: true, email });
  } catch (e: any) {
    const status =
      e instanceof ForbiddenError ? 403 : e instanceof TenantError ? e.status : 500;
    return NextResponse.json({ error: e.message || "Failed to send invite" }, { status });
  }
}
