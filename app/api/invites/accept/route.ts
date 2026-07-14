// app/api/invites/accept/route.ts — validate an invite token and activate the account
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COOKIE_NAME = "sbp_session";

// GET /api/invites/accept?token=... -> returns invite details (to prefill the page)
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite) return NextResponse.json({ error: "Invalid invitation" }, { status: 404 });
  if (invite.acceptedAt) return NextResponse.json({ error: "This invitation has already been used" }, { status: 410 });
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: "This invitation has expired" }, { status: 410 });

  return NextResponse.json({ email: invite.email, fullName: invite.fullName });
}

// POST -> { token, password } creates the user, marks invite used, logs them in
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = String(body.token || "");
    const password = String(body.password || "");

    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const invite = await prisma.invite.findUnique({ where: { token } });
    if (!invite) return NextResponse.json({ error: "Invalid invitation" }, { status: 404 });
    if (invite.acceptedAt) return NextResponse.json({ error: "This invitation has already been used" }, { status: 410 });
    if (invite.expiresAt < new Date()) return NextResponse.json({ error: "This invitation has expired" }, { status: 410 });

    // Guard: no duplicate user
    const existing = await prisma.user.findFirst({
      where: { email: invite.email },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "An account already exists for this email" }, { status: 409 });
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    const user = await prisma.user.create({
      data: {
        companyId: invite.companyId,
        email: invite.email,
        fullName: invite.fullName,
        phone: invite.phone,
        role: invite.role,
        passwordHash,
        isActive: true,
      },
      select: { id: true, email: true, fullName: true, role: true },
    });

    await prisma.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });

    // Log them straight in
    const token2 = createSessionToken(user.id);
    const res = NextResponse.json({ ok: true, user });
    res.cookies.set(COOKIE_NAME, token2, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to accept invite" }, { status: 500 });
  }
}
