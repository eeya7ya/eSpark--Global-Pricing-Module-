export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

// PUT /api/trash/projects/[id] — restore a soft-deleted project
export async function PUT(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const [restored] = await db
      .update(projects)
      .set({ deletedAt: null })
      .where(eq(projects.id, parseInt(id)))
      .returning();

    if (!restored) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(restored);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to restore project" }, { status: 500 });
  }
}

// DELETE /api/trash/projects/[id] — permanently delete a soft-deleted project
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    await db.delete(projects).where(eq(projects.id, parseInt(id)));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to permanently delete project" }, { status: 500 });
  }
}
