export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  projects,
  manufacturers,
  userManufacturers,
  productLines,
} from "@/db/schema";
import { and, asc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

/**
 * Global project search — finds projects across all manufacturers the
 * current user can access. Matches against project name, manufacturer
 * name and product-line item models.
 *
 * Query params:
 *   q            — free-text search (required, min 1 char)
 *   manufacturerId — optional, restrict to a specific manufacturer
 *   limit        — max results (default 25)
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    const limit = Math.min(
      parseInt(searchParams.get("limit") ?? "25", 10) || 25,
      100
    );
    const restrictManufacturerId = searchParams.get("manufacturerId");
    const ownerParam = searchParams.get("ownerUserId");
    const restrictOwnerUserId =
      ownerParam != null && Number.isFinite(parseInt(ownerParam, 10))
        ? parseInt(ownerParam, 10)
        : null;

    if (q.length === 0) {
      return NextResponse.json([]);
    }

    const like = `%${q}%`;

    // Work out which manufacturers the user can see. Admins see all;
    // non-admins see only those they have a user_manufacturers row for.
    let allowedMfgIds: number[] | null = null;
    if (user.role !== "admin") {
      const ums = await db
        .select({ manufacturerId: userManufacturers.manufacturerId })
        .from(userManufacturers)
        .where(
          and(
            eq(userManufacturers.userId, user.id),
            isNull(userManufacturers.deletedAt)
          )
        );
      allowedMfgIds = ums.map((u) => u.manufacturerId);
      if (allowedMfgIds.length === 0) {
        return NextResponse.json([]);
      }
    }

    // Step 1 — find candidate project IDs whose product_lines match the
    // query. Done as a separate query so we can union with name matches.
    const lineMatchIds = await db
      .select({ projectId: productLines.projectId })
      .from(productLines)
      .where(ilike(productLines.itemModel, like))
      .groupBy(productLines.projectId);
    const lineProjectIds = new Set(lineMatchIds.map((r) => r.projectId));

    // Step 2 — fetch projects matching by project name OR manufacturer
    // name OR by ID in the product-line match set.
    const baseConds = [isNull(projects.deletedAt)];
    if (user.role !== "admin") {
      baseConds.push(eq(projects.userId, user.id));
    }
    if (allowedMfgIds) {
      baseConds.push(inArray(projects.manufacturerId, allowedMfgIds));
    }
    if (restrictManufacturerId) {
      const mfgId = parseInt(restrictManufacturerId, 10);
      if (!Number.isNaN(mfgId)) {
        baseConds.push(eq(projects.manufacturerId, mfgId));
      }
    }
    // Admins can further scope to a specific owning user (used when the
    // manufacturer page is opened for a particular user from the admin
    // dashboard). Non-admins are already forced to their own userId above.
    if (restrictOwnerUserId != null && user.role === "admin") {
      baseConds.push(eq(projects.userId, restrictOwnerUserId));
    }

    const matchConds = [
      ilike(projects.name, like),
      ilike(manufacturers.name, like),
    ];
    if (lineProjectIds.size > 0) {
      matchConds.push(inArray(projects.id, Array.from(lineProjectIds)));
    }

    const rows = await db
      .select({
        id: projects.id,
        name: projects.name,
        date: projects.date,
        responsiblePerson: projects.responsiblePerson,
        createdAt: projects.createdAt,
        ownerUserId: projects.userId,
        manufacturerId: projects.manufacturerId,
        manufacturerName: manufacturers.name,
        manufacturerColor: userManufacturers.color,
        manufacturerTag: userManufacturers.tag,
      })
      .from(projects)
      .innerJoin(manufacturers, eq(projects.manufacturerId, manufacturers.id))
      .leftJoin(
        userManufacturers,
        and(
          eq(userManufacturers.manufacturerId, manufacturers.id),
          eq(userManufacturers.userId, user.id),
          isNull(userManufacturers.deletedAt)
        )
      )
      .where(and(...baseConds, or(...matchConds)))
      .orderBy(asc(manufacturers.name), asc(projects.name))
      .limit(limit);

    // Annotate with whether the match was via product-line item model.
    const result = rows.map((r) => ({
      ...r,
      matchedInLines: lineProjectIds.has(r.id),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("[projects/search]", error);
    return NextResponse.json(
      { error: "Failed to search projects" },
      { status: 500 }
    );
  }
}
