export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { manufacturers, userManufacturers } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { logAudit, getClientIp } from "@/lib/audit";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const mfgId = parseInt(id);

    const manufacturer = await db.query.manufacturers.findFirst({
      where: (m, { eq, isNull, and }) => and(eq(m.id, mfgId), isNull(m.deletedAt)),
    });
    if (!manufacturer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (user.role !== "admin") {
      // Non-admins must have a user_manufacturers entry for this manufacturer.
      const userMfg = await db.query.userManufacturers.findFirst({
        where: (um, { eq, and, isNull }) =>
          and(
            eq(um.userId, user.id),
            eq(um.manufacturerId, mfgId),
            isNull(um.deletedAt)
          ),
      });
      if (!userMfg) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // Return manufacturer with the user's own color/tag.
      return NextResponse.json({
        ...manufacturer,
        color: userMfg.color,
        tag: userMfg.tag,
      });
    }

    return NextResponse.json(manufacturer);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch manufacturer" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const mfgId = parseInt(id);

    const existing = await db.query.manufacturers.findFirst({
      where: (m, { eq, isNull, and }) => and(eq(m.id, mfgId), isNull(m.deletedAt)),
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const { name, color, tag } = body ?? {};

    if (user.role !== "admin") {
      // Non-admins update their user_manufacturers entry (color, tag).
      // They may also rename if they created the manufacturer.
      const userMfg = await db.query.userManufacturers.findFirst({
        where: (um, { eq, and, isNull }) =>
          and(
            eq(um.userId, user.id),
            eq(um.manufacturerId, mfgId),
            isNull(um.deletedAt)
          ),
      });
      if (!userMfg) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const umPatch: Partial<{ color: string; tag: string }> = {};
      if (typeof color === "string" && color.trim()) umPatch.color = color.trim();
      if (typeof tag === "string" && tag.trim()) umPatch.tag = tag.trim();

      let updatedUserMfg = userMfg;
      if (Object.keys(umPatch).length > 0) {
        const [u] = await db
          .update(userManufacturers)
          .set(umPatch)
          .where(eq(userManufacturers.id, userMfg.id))
          .returning();
        updatedUserMfg = u;
      }

      // Allow renaming only if this user created the manufacturer.
      let updatedMfg = existing;
      if (typeof name === "string" && name.trim() && existing.createdByUserId === user.id) {
        const [u] = await db
          .update(manufacturers)
          .set({ name: name.trim() })
          .where(and(eq(manufacturers.id, mfgId), isNull(manufacturers.deletedAt)))
          .returning();
        if (u) updatedMfg = u;
      }

      await logAudit({
        actor: user,
        action: "update",
        entityType: "manufacturer",
        entityId: mfgId,
        details: { color: updatedUserMfg.color, tag: updatedUserMfg.tag },
        ipAddress: getClientIp(req),
      });

      return NextResponse.json({
        ...updatedMfg,
        color: updatedUserMfg.color,
        tag: updatedUserMfg.tag,
      });
    }

    // Admin: update the global manufacturer record.
    const patch: Partial<{ name: string; color: string | null; tag: string | null }> = {};
    if (typeof name === "string") {
      if (!name.trim()) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }
      patch.name = name.trim();
    }
    if (Object.prototype.hasOwnProperty.call(body ?? {}, "color")) {
      patch.color = typeof color === "string" && color.trim() ? color.trim() : null;
    }
    if (Object.prototype.hasOwnProperty.call(body ?? {}, "tag")) {
      patch.tag = typeof tag === "string" && tag.trim() ? tag.trim() : null;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const [updated] = await db
      .update(manufacturers)
      .set(patch)
      .where(and(eq(manufacturers.id, mfgId), isNull(manufacturers.deletedAt)))
      .returning();
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await logAudit({
      actor: user,
      action: "update",
      entityType: "manufacturer",
      entityId: mfgId,
      details: {
        from: { name: existing.name, color: existing.color, tag: existing.tag },
        to: { name: updated.name, color: updated.color, tag: updated.tag },
      },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update manufacturer" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const mfgId = parseInt(id);

    // Soft delete the global manufacturer (cascades to user_manufacturers via DB).
    await db
      .update(manufacturers)
      .set({ deletedAt: new Date() })
      .where(eq(manufacturers.id, mfgId));

    await logAudit({
      actor: user,
      action: "delete",
      entityType: "manufacturer",
      entityId: mfgId,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete manufacturer" }, { status: 500 });
  }
}
