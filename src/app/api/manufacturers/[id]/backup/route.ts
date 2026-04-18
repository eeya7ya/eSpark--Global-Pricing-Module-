export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  projects,
  projectConstants,
  productLines,
  manufacturers,
  userManufacturers,
} from "@/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { logAudit, getClientIp } from "@/lib/audit";

const BACKUP_FORMAT_VERSION = 1;

interface BackupLine {
  position: number;
  itemModel: string;
  priceUsd: string;
  quantity: number;
  shippingOverride: string | null;
  customsOverride: string | null;
  shippingRateOverride: string | null;
  customsRateOverride: string | null;
  profitRateOverride: string | null;
}

interface BackupConstants {
  currencyRate: string;
  shippingRate: string;
  customsRate: string;
  profitMargin: string;
  taxRate: string;
  targetCurrency: string;
  sourceCurrency: string;
}

interface BackupProject {
  name: string;
  date: string | null;
  responsiblePerson: string | null;
  createdAt: string;
  constants: BackupConstants | null;
  productLines: BackupLine[];
}

interface BackupPayload {
  formatVersion: number;
  exportedAt: string;
  manufacturer: { id: number; name: string };
  projects: BackupProject[];
}

async function ensureManufacturerAccess(
  mfgId: number,
  user: { id: number; role: "admin" | "user" }
): Promise<
  | { ok: true; manufacturer: { id: number; name: string } }
  | { ok: false; status: number; error: string }
> {
  const manufacturer = await db.query.manufacturers.findFirst({
    where: (m, { eq, isNull, and }) => and(eq(m.id, mfgId), isNull(m.deletedAt)),
  });
  if (!manufacturer) {
    return { ok: false, status: 404, error: "Manufacturer not found" };
  }
  if (user.role !== "admin") {
    const um = await db.query.userManufacturers.findFirst({
      where: (u, { eq, and, isNull }) =>
        and(
          eq(u.userId, user.id),
          eq(u.manufacturerId, mfgId),
          isNull(u.deletedAt)
        ),
    });
    if (!um) return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true, manufacturer: { id: manufacturer.id, name: manufacturer.name } };
}

// ─── GET: export all projects in this manufacturer ───────────────────────────
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const mfgId = parseInt(id);
    if (Number.isNaN(mfgId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const access = await ensureManufacturerAccess(mfgId, user);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const { searchParams } = new URL(req.url);
    const ownerParam = searchParams.get("ownerUserId");
    const ownerUserId =
      ownerParam != null && Number.isFinite(parseInt(ownerParam, 10))
        ? parseInt(ownerParam, 10)
        : null;

    // Fetch projects the user can see in this manufacturer. Non-admins
    // only see their own projects. Admins may scope the export to a single
    // owning user via ?ownerUserId=.
    const projectRows = await db.query.projects.findMany({
      where: (p, { eq, isNull, and }) => {
        const base = and(eq(p.manufacturerId, mfgId), isNull(p.deletedAt));
        if (user.role === "admin") {
          if (ownerUserId != null) return and(base, eq(p.userId, ownerUserId));
          return base;
        }
        return and(base, eq(p.userId, user.id));
      },
      orderBy: (p, { asc }) => [asc(p.createdAt)],
    });

    if (projectRows.length === 0) {
      const payload: BackupPayload = {
        formatVersion: BACKUP_FORMAT_VERSION,
        exportedAt: new Date().toISOString(),
        manufacturer: access.manufacturer,
        projects: [],
      };
      return jsonDownload(payload, access.manufacturer.name);
    }

    const projectIds = projectRows.map((p) => p.id);

    const constRows = await db
      .select()
      .from(projectConstants)
      .where(inArray(projectConstants.projectId, projectIds));
    const constMap = new Map(constRows.map((c) => [c.projectId, c]));

    const lineRows = await db
      .select()
      .from(productLines)
      .where(inArray(productLines.projectId, projectIds));
    const lineMap = new Map<number, BackupLine[]>();
    for (const l of lineRows) {
      const bucket = lineMap.get(l.projectId) ?? [];
      bucket.push({
        position: l.position,
        itemModel: l.itemModel,
        priceUsd: String(l.priceUsd),
        quantity: l.quantity,
        shippingOverride: l.shippingOverride != null ? String(l.shippingOverride) : null,
        customsOverride: l.customsOverride != null ? String(l.customsOverride) : null,
        shippingRateOverride:
          l.shippingRateOverride != null ? String(l.shippingRateOverride) : null,
        customsRateOverride:
          l.customsRateOverride != null ? String(l.customsRateOverride) : null,
        profitRateOverride:
          l.profitRateOverride != null ? String(l.profitRateOverride) : null,
      });
      lineMap.set(l.projectId, bucket);
    }
    for (const lines of lineMap.values()) {
      lines.sort((a, b) => a.position - b.position);
    }

    const payload: BackupPayload = {
      formatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      manufacturer: access.manufacturer,
      projects: projectRows.map((p) => {
        const c = constMap.get(p.id);
        const constants: BackupConstants | null = c
          ? {
              currencyRate: String(c.currencyRate),
              shippingRate: String(c.shippingRate),
              customsRate: String(c.customsRate),
              profitMargin: String(c.profitMargin),
              taxRate: String(c.taxRate),
              targetCurrency: c.targetCurrency,
              sourceCurrency: c.sourceCurrency,
            }
          : null;
        return {
          name: p.name,
          date: p.date ?? null,
          responsiblePerson: p.responsiblePerson ?? null,
          createdAt: p.createdAt.toISOString(),
          constants,
          productLines: lineMap.get(p.id) ?? [],
        };
      }),
    };

    return jsonDownload(payload, access.manufacturer.name);
  } catch (error) {
    console.error("[manufacturers/backup GET]", error);
    return NextResponse.json(
      { error: "Failed to export projects" },
      { status: 500 }
    );
  }
}

function jsonDownload(payload: BackupPayload, mfgName: string) {
  const safe = mfgName.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "backup";
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${safe}-projects-${stamp}.json"`,
    },
  });
}

// ─── POST: import (restore) projects into this manufacturer ──────────────────
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const mfgId = parseInt(id);
    if (Number.isNaN(mfgId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const access = await ensureManufacturerAccess(mfgId, user);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const { searchParams } = new URL(req.url);
    const ownerParam = searchParams.get("ownerUserId");
    const requestedOwnerId =
      ownerParam != null && Number.isFinite(parseInt(ownerParam, 10))
        ? parseInt(ownerParam, 10)
        : null;
    // Only admins can attribute restored projects to a different user.
    const restoreOwnerId =
      user.role === "admin" && requestedOwnerId != null
        ? requestedOwnerId
        : user.id;

    const body = (await req.json()) as Partial<BackupPayload> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    if (!Array.isArray(body.projects)) {
      return NextResponse.json(
        { error: "Payload missing 'projects' array" },
        { status: 400 }
      );
    }

    // Import each project as a new row — we never modify or delete
    // anything that already exists. Names are suffixed with " (restored
    // YYYY-MM-DD)" to make backups easy to distinguish from current work.
    const stamp = new Date().toISOString().slice(0, 10);
    const created: { id: number; name: string }[] = [];
    let skipped = 0;

    for (const bp of body.projects) {
      if (!bp || typeof bp !== "object" || typeof bp.name !== "string" || !bp.name.trim()) {
        skipped++;
        continue;
      }
      const name = `${bp.name.trim()} (restored ${stamp})`;

      const [project] = await db
        .insert(projects)
        .values({
          name,
          date: bp.date ?? null,
          responsiblePerson: typeof bp.responsiblePerson === "string" ? bp.responsiblePerson : null,
          manufacturerId: mfgId,
          userId: restoreOwnerId,
        })
        .returning();

      const c = bp.constants;
      await db.insert(projectConstants).values({
        projectId: project.id,
        currencyRate: c?.currencyRate ?? "0.710000",
        shippingRate: c?.shippingRate ?? "0.150000",
        customsRate: c?.customsRate ?? "0.120000",
        profitMargin: c?.profitMargin ?? "0.250000",
        taxRate: c?.taxRate ?? "0.160000",
        targetCurrency: c?.targetCurrency ?? "JOD",
        sourceCurrency: c?.sourceCurrency ?? "USD",
      });

      const lines = Array.isArray(bp.productLines) ? bp.productLines : [];
      if (lines.length > 0) {
        await db.insert(productLines).values(
          lines.map((l, idx) => ({
            projectId: project.id,
            position: typeof l.position === "number" ? l.position : idx + 1,
            itemModel: typeof l.itemModel === "string" ? l.itemModel : "",
            priceUsd: l.priceUsd != null ? String(l.priceUsd) : "0",
            quantity: typeof l.quantity === "number" && l.quantity > 0 ? l.quantity : 1,
            shippingOverride: l.shippingOverride != null ? String(l.shippingOverride) : null,
            customsOverride: l.customsOverride != null ? String(l.customsOverride) : null,
            shippingRateOverride:
              l.shippingRateOverride != null ? String(l.shippingRateOverride) : null,
            customsRateOverride:
              l.customsRateOverride != null ? String(l.customsRateOverride) : null,
            profitRateOverride:
              l.profitRateOverride != null ? String(l.profitRateOverride) : null,
          }))
        );
      }

      created.push({ id: project.id, name: project.name });
    }

    await logAudit({
      actor: user,
      action: "update",
      entityType: "manufacturer",
      entityId: mfgId,
      details: {
        op: "backup_restore",
        restored: created.length,
        skipped,
      },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      restored: created.length,
      skipped,
      projects: created,
    });
  } catch (error) {
    console.error("[manufacturers/backup POST]", error);
    return NextResponse.json(
      { error: "Failed to restore projects" },
      { status: 500 }
    );
  }
}
