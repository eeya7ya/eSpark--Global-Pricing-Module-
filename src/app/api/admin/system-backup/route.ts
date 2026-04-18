export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  manufacturers,
  userManufacturers,
  projects,
  projectConstants,
  productLines,
  accountRequests,
  auditLogs,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit, getClientIp } from "@/lib/audit";
import { ensureSchema, ensureAdminUser } from "@/lib/ensureSchema";

/**
 * Full-system backup / restore.
 *
 * GET  — admin-only export of every row in every table as a single JSON
 *        file. Preserves primary keys so foreign key relationships stay
 *        intact when the backup is imported into a fresh database.
 *        Password hashes are included so users can still sign in after
 *        the migration. Treat the file as a SECRET.
 *
 * POST — admin-only import. Will ONLY run against a clean target
 *        database (no projects, no manufacturers, no non-admin users).
 *        This guards against wiping a database that already has work
 *        in it. After inserting, PostgreSQL sequences are bumped past
 *        the highest imported id so new inserts don't collide.
 */

const BACKUP_FORMAT_VERSION = 1;

interface SystemBackup {
  formatVersion: number;
  exportedAt: string;
  tables: {
    manufacturers: unknown[];
    users: unknown[];
    userManufacturers: unknown[];
    projects: unknown[];
    projectConstants: unknown[];
    productLines: unknown[];
    accountRequests: unknown[];
    auditLogs: unknown[];
  };
}

// ─── GET: export everything ─────────────────────────────────────────────────
export async function GET(req: Request) {
  try {
    // Make sure every table exists before we try to SELECT from it.
    // This matters for brand-new databases (Supabase, self-hosted…)
    // where nothing has been created yet.
    await ensureSchema();
    await ensureAdminUser();

    const me = await getCurrentUser();
    if (!me || me.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [
      mfgRows,
      userRows,
      userMfgRows,
      projRows,
      constRows,
      lineRows,
      reqRows,
      logRows,
    ] = await Promise.all([
      db.select().from(manufacturers),
      db.select().from(users),
      db.select().from(userManufacturers),
      db.select().from(projects),
      db.select().from(projectConstants),
      db.select().from(productLines),
      db.select().from(accountRequests),
      db.select().from(auditLogs),
    ]);

    const payload: SystemBackup = {
      formatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      tables: {
        manufacturers: mfgRows,
        users: userRows,
        userManufacturers: userMfgRows,
        projects: projRows,
        projectConstants: constRows,
        productLines: lineRows,
        accountRequests: reqRows,
        auditLogs: logRows,
      },
    };

    await logAudit({
      actor: me,
      action: "update",
      entityType: "system",
      details: {
        op: "system_backup_export",
        counts: {
          manufacturers: mfgRows.length,
          users: userRows.length,
          userManufacturers: userMfgRows.length,
          projects: projRows.length,
          projectConstants: constRows.length,
          productLines: lineRows.length,
          accountRequests: reqRows.length,
          auditLogs: logRows.length,
        },
      },
      ipAddress: getClientIp(req),
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="pricing-sheet-system-backup-${stamp}.json"`,
      },
    });
  } catch (error) {
    console.error("[admin/system-backup GET]", error);
    return NextResponse.json(
      { error: "Failed to export system backup" },
      { status: 500 }
    );
  }
}

// ─── POST: import into a fresh database ─────────────────────────────────────
export async function POST(req: Request) {
  try {
    // Ensure the target database has the full schema. On a brand-new
    // Supabase project none of the base tables exist yet, so this is
    // what actually creates them before we attempt the restore.
    await ensureSchema();
    await ensureAdminUser();

    const me = await getCurrentUser();
    if (!me || me.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Safety gate: target must be empty. We consider it empty if there
    // are no manufacturers, no projects, and the only user (if any) is
    // the seeded "admin" account. This lets admins import into a fresh
    // database after changing DATABASE_URL, without ever touching a
    // database that already has real work in it.
    const [mfgCount, projCount, nonAdminCount] = await Promise.all([
      db.select({ n: sql<number>`count(*)::int` }).from(manufacturers),
      db.select({ n: sql<number>`count(*)::int` }).from(projects),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(users)
        .where(sql`username <> 'admin'`),
    ]);

    const dirty =
      (mfgCount[0]?.n ?? 0) > 0 ||
      (projCount[0]?.n ?? 0) > 0 ||
      (nonAdminCount[0]?.n ?? 0) > 0;

    if (dirty) {
      return NextResponse.json(
        {
          error:
            "Target database is not empty. Restore is only allowed into a fresh database (no manufacturers, no projects, and no users other than the built-in admin).",
        },
        { status: 409 }
      );
    }

    const body = (await req.json()) as Partial<SystemBackup> | null;
    if (!body || typeof body !== "object" || !body.tables) {
      return NextResponse.json(
        { error: "Invalid backup file." },
        { status: 400 }
      );
    }
    if (body.formatVersion !== BACKUP_FORMAT_VERSION) {
      return NextResponse.json(
        {
          error: `Unsupported backup format version: ${body.formatVersion}. Expected ${BACKUP_FORMAT_VERSION}.`,
        },
        { status: 400 }
      );
    }

    const t = body.tables;

    // Convert timestamp strings back to Date objects. Drizzle's timestamp
    // columns expect Date, not strings.
    const toDate = (v: unknown): Date | null => {
      if (!v) return null;
      if (v instanceof Date) return v;
      if (typeof v === "string") {
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
      }
      return null;
    };

    const counts = {
      manufacturers: 0,
      users: 0,
      userManufacturers: 0,
      projects: 0,
      projectConstants: 0,
      productLines: 0,
      accountRequests: 0,
      auditLogs: 0,
    };

    // Insert in chunks so we stay under PostgreSQL's 65,535-parameter
    // limit per statement. 500 rows × ~15 columns = ~7,500 params leaves
    // plenty of headroom even for the widest table (product_lines).
    const CHUNK = 500;
    const insertChunked = async <R,>(
      table: any,
      rows: R[]
    ): Promise<void> => {
      for (let i = 0; i < rows.length; i += CHUNK) {
        await db.insert(table).values(rows.slice(i, i + CHUNK));
      }
    };

    // Wipe the seeded admin (if present) so its id doesn't collide with
    // the imported admin row. The importing admin's session cookie will
    // stop working after this point — that's the expected tradeoff for
    // a clean migration.
    await db.execute(sql`DELETE FROM users WHERE username = 'admin'`);

    // 1. manufacturers
    if (Array.isArray(t.manufacturers) && t.manufacturers.length > 0) {
      const rows = (t.manufacturers as any[]).map((m) => ({
        id: m.id,
        name: m.name,
        color: m.color ?? null,
        tag: m.tag ?? null,
        createdAt: toDate(m.createdAt) ?? new Date(),
        deletedAt: toDate(m.deletedAt),
        createdByUserId: m.createdByUserId ?? null,
      }));
      await insertChunked(manufacturers, rows);
      counts.manufacturers = rows.length;
    }

    // 2. users
    if (Array.isArray(t.users) && t.users.length > 0) {
      const rows = (t.users as any[]).map((u) => ({
        id: u.id,
        username: u.username,
        passwordHash: u.passwordHash,
        fullName: u.fullName,
        role: u.role ?? "user",
        color: u.color ?? "cyan",
        manufacturerId: u.manufacturerId ?? null,
        createdAt: toDate(u.createdAt) ?? new Date(),
      }));
      await insertChunked(users, rows);
      counts.users = rows.length;
    }

    // 3. userManufacturers
    if (
      Array.isArray(t.userManufacturers) &&
      t.userManufacturers.length > 0
    ) {
      const rows = (t.userManufacturers as any[]).map((x) => ({
        id: x.id,
        userId: x.userId,
        manufacturerId: x.manufacturerId,
        color: x.color ?? "cyan",
        tag: x.tag ?? "",
        createdAt: toDate(x.createdAt) ?? new Date(),
        deletedAt: toDate(x.deletedAt),
      }));
      await insertChunked(userManufacturers, rows);
      counts.userManufacturers = rows.length;
    }

    // 4. projects
    if (Array.isArray(t.projects) && t.projects.length > 0) {
      const rows = (t.projects as any[]).map((p) => ({
        id: p.id,
        name: p.name,
        date: p.date ?? null,
        responsiblePerson: p.responsiblePerson ?? null,
        manufacturerId: p.manufacturerId,
        userId: p.userId ?? null,
        createdAt: toDate(p.createdAt) ?? new Date(),
        deletedAt: toDate(p.deletedAt),
      }));
      await insertChunked(projects, rows);
      counts.projects = rows.length;
    }

    // 5. projectConstants
    if (
      Array.isArray(t.projectConstants) &&
      t.projectConstants.length > 0
    ) {
      const rows = (t.projectConstants as any[]).map((c) => ({
        id: c.id,
        projectId: c.projectId,
        currencyRate: String(c.currencyRate ?? "0.710000"),
        shippingRate: String(c.shippingRate ?? "0.150000"),
        customsRate: String(c.customsRate ?? "0.120000"),
        profitMargin: String(c.profitMargin ?? "0.250000"),
        taxRate: String(c.taxRate ?? "0.160000"),
        targetCurrency: c.targetCurrency ?? "JOD",
        sourceCurrency: c.sourceCurrency ?? "USD",
      }));
      await insertChunked(projectConstants, rows);
      counts.projectConstants = rows.length;
    }

    // 6. productLines
    if (Array.isArray(t.productLines) && t.productLines.length > 0) {
      const rows = (t.productLines as any[]).map((l) => ({
        id: l.id,
        projectId: l.projectId,
        position: l.position,
        itemModel: l.itemModel ?? "",
        priceUsd: String(l.priceUsd ?? "0"),
        quantity: typeof l.quantity === "number" ? l.quantity : 1,
        shippingOverride:
          l.shippingOverride != null ? String(l.shippingOverride) : null,
        customsOverride:
          l.customsOverride != null ? String(l.customsOverride) : null,
        shippingRateOverride:
          l.shippingRateOverride != null
            ? String(l.shippingRateOverride)
            : null,
        customsRateOverride:
          l.customsRateOverride != null
            ? String(l.customsRateOverride)
            : null,
        profitRateOverride:
          l.profitRateOverride != null
            ? String(l.profitRateOverride)
            : null,
      }));
      await insertChunked(productLines, rows);
      counts.productLines = rows.length;
    }

    // 7. accountRequests
    if (
      Array.isArray(t.accountRequests) &&
      t.accountRequests.length > 0
    ) {
      const rows = (t.accountRequests as any[]).map((r) => ({
        id: r.id,
        fullName: r.fullName,
        email: r.email,
        company: r.company ?? "",
        message: r.message ?? "",
        status: r.status ?? "pending",
        createdAt: toDate(r.createdAt) ?? new Date(),
      }));
      await insertChunked(accountRequests, rows);
      counts.accountRequests = rows.length;
    }

    // 8. auditLogs
    if (Array.isArray(t.auditLogs) && t.auditLogs.length > 0) {
      const rows = (t.auditLogs as any[]).map((l) => ({
        id: l.id,
        actorUserId: l.actorUserId ?? null,
        actorUsername: l.actorUsername ?? null,
        actorName: l.actorName ?? null,
        action: l.action,
        entityType: l.entityType ?? null,
        entityId: l.entityId ?? null,
        details: l.details ?? null,
        ipAddress: l.ipAddress ?? null,
        createdAt: toDate(l.createdAt) ?? new Date(),
      }));
      await insertChunked(auditLogs, rows);
      counts.auditLogs = rows.length;
    }

    // Bump each table's id sequence past the highest imported id so
    // future inserts don't collide with what we just restored.
    const sequenceTables = [
      "manufacturers",
      "users",
      "user_manufacturers",
      "projects",
      "project_constants",
      "product_lines",
      "account_requests",
      "audit_logs",
    ];
    for (const tbl of sequenceTables) {
      await db.execute(
        sql.raw(
          `SELECT setval(pg_get_serial_sequence('${tbl}', 'id'), ` +
            `GREATEST((SELECT COALESCE(MAX(id), 0) FROM ${tbl}), 1), true)`
        )
      );
    }

    // Audit the restore. (The actor id in `me` may no longer exist if
    // the seeded admin was replaced by the import — logAudit handles
    // that gracefully by falling back to the actor's username/name.)
    await logAudit({
      actor: me,
      action: "update",
      entityType: "system",
      details: { op: "system_backup_restore", counts },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true, counts });
  } catch (error) {
    console.error("[admin/system-backup POST]", error);
    const message =
      error instanceof Error ? error.message : "Failed to import backup";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
