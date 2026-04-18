export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, manufacturers } from "@/db/schema";
import { MANUFACTURER_COLORS, DEFAULT_MANUFACTURER_COLOR } from "@/lib/manufacturerColors";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { logAudit, getClientIp } from "@/lib/audit";

export async function GET() {
  try {
    const me = await getCurrentUser();
    if (!me || me.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const allUsers = await db.query.users.findMany({
      orderBy: (u, { asc }) => [asc(u.createdAt)],
    });

    // Never expose password hashes.
    return NextResponse.json(
      allUsers.map(({ passwordHash: _ph, ...u }) => u)
    );
  } catch (error) {
    console.error("[admin/users GET]", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me || me.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      username,
      password,
      fullName,
      color,            // accent color key (e.g. "cyan", "purple")
      role,             // optional: "admin" | "user" (defaults to "user")
      manufacturerId,   // optional existing manufacturer id
      manufacturerName, // optional: create a new manufacturer to assign
    } = body ?? {};

    if (!username?.trim() || !password || !fullName?.trim()) {
      return NextResponse.json(
        { error: "username, password, and fullName are required." },
        { status: 400 }
      );
    }

    // Usernames are ascii, lowercase, 3-32 chars, letters/digits/._-
    const normalized = String(username).trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,32}$/.test(normalized)) {
      return NextResponse.json(
        {
          error:
            "Username must be 3-32 chars and use only letters, digits, dot, underscore, or dash.",
        },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    // Resolve manufacturer assignment (optional).
    let mfgId: number | null =
      typeof manufacturerId === "number" ? manufacturerId : null;

    if (!mfgId && typeof manufacturerName === "string" && manufacturerName.trim()) {
      const [newMfg] = await db
        .insert(manufacturers)
        .values({ name: manufacturerName.trim(), createdByUserId: me.id })
        .returning();
      mfgId = newMfg.id;
    }

    const passwordHash = await hashPassword(password);

    // Validate and normalise color — fall back to default if not provided or invalid.
    const validColorKeys = MANUFACTURER_COLORS.map((c) => c.key);
    const resolvedColor =
      typeof color === "string" && validColorKeys.includes(color)
        ? color
        : DEFAULT_MANUFACTURER_COLOR.key;

    // Validate role — admins may assign either "admin" or "user"; default is "user".
    const resolvedRole =
      role === "admin" || role === "user" ? role : "user";

    const [user] = await db
      .insert(users)
      .values({
        username: normalized,
        passwordHash,
        fullName: String(fullName).trim(),
        role: resolvedRole,
        color: resolvedColor,
        manufacturerId: mfgId,
      })
      .returning();

    await logAudit({
      actor: me,
      action: "create",
      entityType: "user",
      entityId: user.id,
      details: {
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        manufacturerId: mfgId,
      },
      ipAddress: getClientIp(req),
    });

    const { passwordHash: _ph, ...safe } = user;
    return NextResponse.json(
      { success: true, user: safe },
      { status: 201 }
    );
  } catch (error: any) {
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "A user with this username already exists." },
        { status: 409 }
      );
    }
    console.error("[admin/users POST]", error);
    return NextResponse.json({ error: "Failed to create user." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me || me.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    if (!idParam) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const id = parseInt(idParam);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "invalid id" }, { status: 400 });
    }

    const target = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, id),
    });
    if (!target) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const { fullName, color, manufacturerId, role } = body ?? {};

    const updates: Record<string, unknown> = {};

    if (typeof role === "string") {
      if (role !== "admin" && role !== "user") {
        return NextResponse.json(
          { error: "Role must be either 'admin' or 'user'." },
          { status: 400 }
        );
      }
      // Never let the built-in admin be demoted, and never let an admin
      // demote themselves — this would leave the instance without any
      // admin capable of re-promoting accounts.
      if (role !== target.role) {
        if (target.username === "admin" && role !== "admin") {
          return NextResponse.json(
            { error: "The built-in admin account cannot be demoted." },
            { status: 400 }
          );
        }
        if (target.id === me.id && role !== "admin") {
          return NextResponse.json(
            { error: "You cannot change your own role." },
            { status: 400 }
          );
        }
        updates.role = role;
      }
    }

    if (typeof fullName === "string") {
      const trimmed = fullName.trim();
      if (trimmed.length === 0) {
        return NextResponse.json(
          { error: "fullName cannot be empty." },
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

    if (manufacturerId === null) {
      updates.manufacturerId = null;
    } else if (typeof manufacturerId === "number") {
      updates.manufacturerId = manufacturerId;
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
      .where(eq(users.id, id))
      .returning();

    await logAudit({
      actor: me,
      action: "update",
      entityType: "user",
      entityId: id,
      details: { username: target.username, changes: updates },
      ipAddress: getClientIp(req),
    });

    const { passwordHash: _ph, ...safe } = updated;
    return NextResponse.json({ success: true, user: safe });
  } catch (error) {
    console.error("[admin/users PATCH]", error);
    return NextResponse.json({ error: "Failed to update user." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me || me.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    if (!idParam) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const id = parseInt(idParam);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "invalid id" }, { status: 400 });
    }

    const target = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, id),
    });
    if (!target) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // Never let an admin delete themselves or the built-in admin.
    if (target.username === "admin" || target.id === me.id) {
      return NextResponse.json(
        { error: "This account cannot be deleted." },
        { status: 400 }
      );
    }

    const { eq } = await import("drizzle-orm");
    await db.delete(users).where(eq(users.id, id));

    await logAudit({
      actor: me,
      action: "delete",
      entityType: "user",
      entityId: id,
      details: { username: target.username },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/users DELETE]", error);
    return NextResponse.json({ error: "Failed to delete user." }, { status: 500 });
  }
}
