export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import {
  COOKIE_NAME,
  getCurrentUser,
  signToken,
  type AuthUser,
} from "@/lib/auth";
import { MANUFACTURER_COLORS } from "@/lib/manufacturerColors";
import { logAudit, getClientIp } from "@/lib/audit";

export async function PATCH(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { fullName, color } = body ?? {};

    const updates: Record<string, unknown> = {};

    if (typeof fullName === "string") {
      const trimmed = fullName.trim();
      if (trimmed.length === 0) {
        return NextResponse.json(
          { error: "Full name cannot be empty." },
          { status: 400 }
        );
      }
      updates.fullName = trimmed;
    }

    if (typeof color === "string") {
      const validColorKeys = MANUFACTURER_COLORS.map((c) => c.key);
      if (!validColorKeys.includes(color)) {
        return NextResponse.json(
          { error: "Invalid color." },
          { status: 400 }
        );
      }
      updates.color = color;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update." },
        { status: 400 }
      );
    }

    const { eq } = await import("drizzle-orm");
    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, me.id))
      .returning();

    await logAudit({
      actor: me,
      action: "update",
      entityType: "user",
      entityId: me.id,
      details: { self: true, changes: updates },
      ipAddress: getClientIp(req),
    });

    // Re-sign the JWT so the nav bar / context reflects the new values
    // immediately without a re-login.
    const refreshed: AuthUser = {
      id: updated.id,
      username: updated.username,
      fullName: updated.fullName,
      role: updated.role as "admin" | "user",
      color: updated.color ?? "cyan",
      manufacturerId: updated.manufacturerId ?? null,
    };
    const token = await signToken(refreshed);

    const res = NextResponse.json({ success: true, user: refreshed });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    return res;
  } catch (error) {
    console.error("[auth/profile PATCH]", error);
    return NextResponse.json(
      { error: "Failed to update profile." },
      { status: 500 }
    );
  }
}
