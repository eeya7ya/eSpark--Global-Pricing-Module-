export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { manufacturers, userManufacturers, projects, users } from "@/db/schema";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { ensureSchema } from "@/lib/ensureSchema";
import { logAudit, getClientIp } from "@/lib/audit";

export async function GET() {
  await ensureSchema();

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role === "admin") {
      // Admin sees one card per (user, manufacturer) pair so that
      // every user's added manufacturers are visible — each tagged with
      // its owning user's username and accent color.
      const rows = await db
        .select({
          manufacturerId: manufacturers.id,
          name: manufacturers.name,
          umColor: userManufacturers.color,
          umTag: userManufacturers.tag,
          createdAt: userManufacturers.createdAt,
          ownerUserId: users.id,
          ownerUserName: users.fullName,
          ownerUsername: users.username,
          ownerColor: users.color,
        })
        .from(userManufacturers)
        .innerJoin(manufacturers, eq(userManufacturers.manufacturerId, manufacturers.id))
        .innerJoin(users, eq(userManufacturers.userId, users.id))
        .where(
          and(
            isNull(userManufacturers.deletedAt),
            isNull(manufacturers.deletedAt)
          )
        )
        .orderBy(asc(users.fullName), asc(manufacturers.name));

      if (rows.length === 0) return NextResponse.json([]);

      // Per-(manufacturer, user) project counts so each card shows the
      // owning user's project total, not the global total.
      const mfgIds = [...new Set(rows.map((r) => r.manufacturerId))];
      const userIds = [...new Set(rows.map((r) => r.ownerUserId))];

      const countsRows = await db
        .select({
          manufacturerId: projects.manufacturerId,
          userId: projects.userId,
          count: sql<number>`count(*)::int`,
        })
        .from(projects)
        .where(
          and(
            isNull(projects.deletedAt),
            inArray(projects.manufacturerId, mfgIds),
            inArray(projects.userId, userIds)
          )
        )
        .groupBy(projects.manufacturerId, projects.userId);

      const countMap = new Map<string, number>();
      for (const row of countsRows) {
        if (row.userId == null) continue;
        countMap.set(`${row.manufacturerId}:${row.userId}`, Number(row.count));
      }

      return NextResponse.json(
        rows.map((r) => ({
          id: r.manufacturerId,
          name: r.name,
          color: r.umColor || r.ownerColor || "cyan",
          tag: r.umTag?.trim() ? r.umTag : r.ownerUsername,
          createdAt: r.createdAt,
          ownerUserId: r.ownerUserId,
          ownerUserName: r.ownerUserName,
          projectCount: countMap.get(`${r.manufacturerId}:${r.ownerUserId}`) ?? 0,
        }))
      );
    }

    // Non-admin: return their user_manufacturers rows.
    // Color is from user_manufacturers (seeded from users.color at creation).
    // Tag is their username (also stored in user_manufacturers).
    const rows = await db
      .select({
        id: manufacturers.id,
        name: manufacturers.name,
        color: userManufacturers.color,
        tag: userManufacturers.tag,
        createdAt: userManufacturers.createdAt,
      })
      .from(userManufacturers)
      .innerJoin(manufacturers, eq(userManufacturers.manufacturerId, manufacturers.id))
      .where(
        and(
          eq(userManufacturers.userId, user.id),
          isNull(userManufacturers.deletedAt),
          isNull(manufacturers.deletedAt)
        )
      )
      .orderBy(asc(userManufacturers.createdAt));

    if (rows.length === 0) return NextResponse.json([]);

    const mfgIds = rows.map((r) => r.id);
    let countsRows: { manufacturerId: number; count: number | string }[] = [];
    try {
      countsRows = await db
        .select({
          manufacturerId: projects.manufacturerId,
          count: sql<number>`count(*)::int`,
        })
        .from(projects)
        .where(
          and(
            isNull(projects.deletedAt),
            eq(projects.userId, user.id),
            inArray(projects.manufacturerId, mfgIds)
          )
        )
        .groupBy(projects.manufacturerId);
    } catch (countErr) {
      console.error("[manufacturers GET] counts query failed:", countErr);
    }

    const countMap = new Map<number, number>();
    for (const row of countsRows) countMap.set(row.manufacturerId, Number(row.count));

    return NextResponse.json(
      rows.map((r) => ({
        ...r,
        ownerUserId: user.id,
        ownerUserName: user.fullName,
        projectCount: countMap.get(r.id) ?? 0,
      }))
    );
  } catch (error) {
    console.error("[manufacturers GET]", error);
    return NextResponse.json({ error: "Failed to fetch manufacturers" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  await ensureSchema();

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Color comes from the user's profile (set once at account creation).
    // Tag is always the user's username.
    const color = user.color ?? "cyan";
    const tag = user.username;

    // Find or create the global manufacturer by name.
    let manufacturer = await db.query.manufacturers.findFirst({
      where: (m, { eq, isNull, and }) => and(eq(m.name, name.trim()), isNull(m.deletedAt)),
    });

    if (!manufacturer) {
      [manufacturer] = await db
        .insert(manufacturers)
        .values({ name: name.trim(), createdByUserId: user.id })
        .returning();
    }

    // Check for an existing (possibly soft-deleted) user_manufacturers entry.
    const existing = await db.query.userManufacturers.findFirst({
      where: (um, { eq, and }) =>
        and(eq(um.userId, user.id), eq(um.manufacturerId, manufacturer!.id)),
    });

    let userMfg;
    if (existing) {
      if (!existing.deletedAt) {
        return NextResponse.json(
          { error: "You already have this manufacturer" },
          { status: 409 }
        );
      }
      // Restore with current user color/tag.
      [userMfg] = await db
        .update(userManufacturers)
        .set({ color, tag, deletedAt: null })
        .where(eq(userManufacturers.id, existing.id))
        .returning();
    } else {
      [userMfg] = await db
        .insert(userManufacturers)
        .values({ userId: user.id, manufacturerId: manufacturer!.id, color, tag })
        .returning();
    }

    await logAudit({
      actor: user,
      action: "create",
      entityType: "manufacturer",
      entityId: manufacturer!.id,
      details: { name: manufacturer!.name, color: userMfg.color, tag: userMfg.tag },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json(
      { ...manufacturer, color: userMfg.color, tag: userMfg.tag },
      { status: 201 }
    );
  } catch (error) {
    console.error("[manufacturers POST]", error);
    return NextResponse.json({ error: "Failed to create manufacturer" }, { status: 500 });
  }
}
