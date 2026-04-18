export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { manufacturers, projects } from "@/db/schema";
import { isNotNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

// GET /api/trash — list all soft-deleted manufacturers and projects (admin only)
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const deletedManufacturers = await db.query.manufacturers.findMany({
      where: (m, { isNotNull }) => isNotNull(m.deletedAt),
      orderBy: (m, { desc }) => [desc(m.deletedAt)],
    });

    const deletedProjects = await db.query.projects.findMany({
      where: (p, { isNotNull }) => isNotNull(p.deletedAt),
      orderBy: (p, { desc }) => [desc(p.deletedAt)],
    });

    // Attach manufacturer name to each project
    const allMfgs = await db.query.manufacturers.findMany();
    const mfgMap = Object.fromEntries(allMfgs.map((m) => [m.id, m.name]));

    return NextResponse.json({
      manufacturers: deletedManufacturers,
      projects: deletedProjects.map((p) => ({
        ...p,
        manufacturerName: mfgMap[p.manufacturerId] ?? `#${p.manufacturerId}`,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch trash" }, { status: 500 });
  }
}
