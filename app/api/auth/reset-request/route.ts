// app/api/auth/reset-request/route.ts — send a password reset link
import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const APP_URL = (process.env.APP_URL || "").replace(/\/$/, "");

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();

    // Always respond 200 (don't reveal whether an account exists)
    if (!email) return NextResponse.json({ ok: true });

    const user = await prisma.user.findFirst({
      where: { email, isActive: true },
      select: { id: true, email: true, fullName: true },
    });

    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken: token, resetTokenExpiresAt: expiresAt },
      });
      const resetUrl = `${APP_URL}/reset-password?token=${token}`;
      try {
        await sendPasswordResetEmail({ to: user.email, fullName: user.fullName, resetUrl });
      } catch (e) {
        console.error("[reset-request] email failed:", e);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: true }); // never leak errors here
  }
}
