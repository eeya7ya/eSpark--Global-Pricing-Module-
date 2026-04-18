export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, projectConstants, productLines } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { ensureSchema } from "@/lib/ensureSchema";
import { logAudit, getClientIp } from "@/lib/audit";

export async function GET(req: Request) {
  await ensureSchema();

  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const manufacturerId = searchParams.get("manufacturerId");
    if (!manufacturerId) {
      return NextResponse.json({ error: "manufacturerId required" }, { status: 400 });
    }

    const mfgId = parseInt(manufacturerId);

    // Optional ownerUserId lets admin pages scope a manufacturer view to a
    // single owner — so when admin opens "HIKVISION" from user X's card,
    // they only see user X's projects, not a blended list.
    const ownerParam = searchParams.get("ownerUserId");
    const ownerUserId = ownerParam != null ? parseInt(ownerParam, 10) : NaN;
    const hasOwnerFilter = Number.isFinite(ownerUserId);

    // Shared manufacturers: any signed-in user can list projects, but
    // non-admins only see their own projects. Admins honour the optional
    // ownerUserId filter so cross-user bleed can't happen.
    const all = await db.query.projects.findMany({
      where: (p, { eq, isNull, and }) => {
        const base = and(eq(p.manufacturerId, mfgId), isNull(p.deletedAt));
        if (user.role === "admin") {
          if (hasOwnerFilter) return and(base, eq(p.userId, ownerUserId));
          return base;
        }
        return and(base, eq(p.userId, user.id));
      },
      orderBy: (p, { asc }) => [asc(p.createdAt)],
    });
    return NextResponse.json(all);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  await ensureSchema();

  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, manufacturerId, responsiblePerson, ownerUserId: ownerUserIdRaw } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!manufacturerId) {
      return NextResponse.json({ error: "manufacturerId is required" }, { status: 400 });
    }

    const mfgId = parseInt(manufacturerId);

    // If an admin is acting inside another user's manufacturer view, the
    // client sends that user's id so the new project is attributed to
    // them. Non-admins always own what they create.
    const requestedOwnerId =
      typeof ownerUserIdRaw === "number"
        ? ownerUserIdRaw
        : typeof ownerUserIdRaw === "string"
          ? parseInt(ownerUserIdRaw, 10)
          : NaN;
    const ownerId =
      user.role === "admin" && Number.isFinite(requestedOwnerId)
        ? requestedOwnerId
        : user.id;

    const [project] = await db
      .insert(projects)
      .values({
        name: name.trim(),
        responsiblePerson: responsiblePerson?.trim() || null,
        manufacturerId: mfgId,
        userId: ownerId,
      })
      .returning();

    await db.insert(projectConstants).values({ projectId: project.id });

    await db.insert(productLines).values(
      Array.from({ length: 5 }, (_, i) => ({
        projectId: project.id,
        position: i + 1,
        itemModel: "",
        priceUsd: "0",
        quantity: 1,
      }))
    );

    await logAudit({
      actor: user,
      action: "create",
      entityType: "project",
      entityId: project.id,
      details: { name: project.name, manufacturerId: mfgId },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
