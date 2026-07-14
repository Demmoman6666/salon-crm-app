// app/api/auth/reset/route.ts — validate reset token and set new password
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET ?token=... -> check token validity (for the page to show a valid/invalid state)
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const user = await prisma.user.findFirst({
    where: { resetToken: token },
    select: { resetTokenExpiresAt: true, email: true },
  });
  if (!user) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  if (!user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
    return NextResponse.json({ error: "This link has expired" }, { status: 410 });
  }
  return NextResponse.json({ ok: true, email: user.email });
}

// POST { token, password }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = String(body?.token || "");
    const password = String(body?.password || "");

    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { resetToken: token },
      select: { id: true, resetTokenExpiresAt: true },
    });
    if (!user) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
    if (!user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
      return NextResponse.json({ error: "This link has expired" }, { status: 410 });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetTokenExpiresAt: null },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to reset password" }, { status: 500 });
  }
}
