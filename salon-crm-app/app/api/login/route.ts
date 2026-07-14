// app/api/login/route.ts
import { NextResponse, NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// --- small helpers for the signed cookie your middleware verifies ---
const COOKIE_NAME = "sbp_session";

function b64url(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return Buffer.from(bin, "binary").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payloadJson: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(process.env.AUTH_SECRET || "dev-insecure-secret-change-me"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const payloadBytes = new TextEncoder().encode(payloadJson);
  const sig = await crypto.subtle.sign("HMAC", key, payloadBytes);
  return `${b64url(payloadBytes)}.${b64url(new Uint8Array(sig))}`;
}

// GET /api/login?ping=1 — simple health check
export async function GET(req: NextRequest) {
  const ping = req.nextUrl.searchParams.get("ping");
  if (ping) return NextResponse.json({ ok: true, method: "GET" });
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  try {
    // Accept JSON or form posts
    let email = "";
    let password = "";

    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const j = await req.json().catch(() => ({}));
      email = String(j?.email ?? "");
      password = String(j?.password ?? "");
    } else {
      const fd = await req.formData();
      email = String(fd.get("email") ?? "");
      password = String(fd.get("password") ?? "");
    }

    email = email.trim().toLowerCase();
    password = password ?? "";

    if (!email || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
    }

    // Look up the user, then verify the password with bcrypt
    const dbUser = await prisma.user.findFirst({
      where: { email, isActive: true },
      select: { id: true, fullName: true, email: true, role: true, isActive: true, passwordHash: true },
    });

    if (!dbUser || !dbUser.passwordHash) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const passwordOk = await bcrypt.compare(String(password), dbUser.passwordHash);
    if (!passwordOk) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = dbUser;

    // Create a short self-signed session token (HMAC, same scheme as middleware)
    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30; // 30 days
    const token = await sign(JSON.stringify({ userId: user.id, exp }));

    const res = NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    });

    // Primary cookie used by middleware
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    // Optional legacy helper (if any server code still reads sbp_email)
    res.cookies.set("sbp_email", email, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
