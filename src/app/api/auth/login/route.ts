export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signToken, comparePassword, COOKIE_NAME, type AuthUser } from "@/lib/auth";
import { ensureSchema, ensureAdminUser } from "@/lib/ensureSchema";
import { logAudit, getClientIp } from "@/lib/audit";

export async function POST(req: Request) {
  const ip = getClientIp(req);

  // Make sure the admin account exists and audit_logs table is ready
  // before we try to authenticate anyone. If the target database is
  // unreachable or schema setup fails (e.g. wrong Supabase credentials,
  // pooler SSL issue, etc.) surface the real reason instead of a
  // generic "Login failed." so the operator can fix it.
  try {
    await ensureSchema();
    await ensureAdminUser();
  } catch (error) {
    console.error("[auth/login] schema setup failed:", error);
    const message =
      error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error:
          "Database not ready: " +
          message +
          " — see /api/health for details.",
      },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    // Accept { username } going forward, but keep { email } as a
    // compatibility alias so older clients keep working during rollout.
    const rawIdentifier: string | undefined = body?.username ?? body?.email;
    const password: string | undefined = body?.password;

    if (!rawIdentifier?.trim() || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 }
      );
    }

    const normalized = rawIdentifier.trim().toLowerCase();

    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.username, normalized),
    });

    if (!user) {
      await logAudit({
        actorUsername: normalized,
        action: "login_failed",
        details: { reason: "user_not_found" },
        ipAddress: ip,
      });
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      await logAudit({
        actorUsername: user.username,
        actorName: user.fullName,
        action: "login_failed",
        details: { reason: "bad_password" },
        ipAddress: ip,
      });
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    const authUser: AuthUser = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role as "admin" | "user",
      color: user.color ?? "cyan",
      manufacturerId: user.manufacturerId ?? null,
    };

    const token = await signToken(authUser);

    // With the shared-manufacturer model, every signed-in user lands on
    // the same dashboard. Admin sees everything; users see shared
    // manufacturers with only their own projects inside.
    const redirectTo = "/";

    const res = NextResponse.json({ user: authUser, redirectTo });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    await logAudit({
      actor: authUser,
      action: "login",
      ipAddress: ip,
    });

    return res;
  } catch (error) {
    console.error("[auth/login]", error);
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
