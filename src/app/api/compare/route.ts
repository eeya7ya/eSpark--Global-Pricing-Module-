export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Manufacturers are shared between all users — everyone sees the
    // full list, but non-admins only see their own projects inside.
    const allManufacturers = await db.query.manufacturers.findMany({
      where: (m, { isNull }) => isNull(m.deletedAt),
      orderBy: (m, { asc }) => [asc(m.createdAt)],
    });

    const result = await Promise.all(
      allManufacturers.map(async (manufacturer) => {
        const mProjects = await db.query.projects.findMany({
          where: (p, { eq, isNull, and }) => {
            const base = and(eq(p.manufacturerId, manufacturer.id), isNull(p.deletedAt));
            if (user.role === "admin") return base;
            return and(base, eq(p.userId, user.id));
          },
          orderBy: (p, { asc }) => [asc(p.createdAt)],
        });

        const projectsWithData = await Promise.all(
          mProjects.map(async (project) => {
            const constants = await db.query.projectConstants.findFirst({
              where: (c, { eq }) => eq(c.projectId, project.id),
            });
            const lines = await db.query.productLines.findMany({
              where: (l, { eq }) => eq(l.projectId, project.id),
              orderBy: (l, { asc }) => [asc(l.position)],
            });
            return { project, constants, productLines: lines };
          })
        );

        return { manufacturer, projects: projectsWithData };
      })
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch comparison data" }, { status: 500 });
  }
}
