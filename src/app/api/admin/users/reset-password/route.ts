export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { logAudit, getClientIp } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me || me.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, newPassword } = body ?? {};

    if (typeof userId !== "number" || !Number.isFinite(userId)) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const target = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId),
    });
    if (!target) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const passwordHash = await hashPassword(newPassword);

    const { eq } = await import("drizzle-orm");
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, userId));

    await logAudit({
      actor: me,
      action: "reset_password",
      entityType: "user",
      entityId: userId,
      details: { username: target.username },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/users/reset-password]", error);
    return NextResponse.json(
      { error: "Failed to reset password." },
      { status: 500 }
    );
  }
}
