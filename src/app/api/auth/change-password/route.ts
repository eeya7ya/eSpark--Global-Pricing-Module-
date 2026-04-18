export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import {
  comparePassword,
  getCurrentUser,
  hashPassword,
} from "@/lib/auth";
import { logAudit, getClientIp } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { currentPassword, newPassword } = body ?? {};

    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return NextResponse.json(
        { error: "Current and new password are required." },
        { status: 400 }
      );
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters." },
        { status: 400 }
      );
    }
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "New password must be different from the current one." },
        { status: 400 }
      );
    }

    const row = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, me.id),
    });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const valid = await comparePassword(currentPassword, row.passwordHash);
    if (!valid) {
      await logAudit({
        actor: me,
        action: "change_password_failed",
        entityType: "user",
        entityId: me.id,
        details: { reason: "bad_current_password" },
        ipAddress: getClientIp(req),
      });
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 401 }
      );
    }

    const passwordHash = await hashPassword(newPassword);
    const { eq } = await import("drizzle-orm");
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, me.id));

    await logAudit({
      actor: me,
      action: "change_password",
      entityType: "user",
      entityId: me.id,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[auth/change-password]", error);
    return NextResponse.json(
      { error: "Failed to change password." },
      { status: 500 }
    );
  }
}
