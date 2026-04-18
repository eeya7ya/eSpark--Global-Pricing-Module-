export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db, resolveDatabaseUrl } from "@/lib/db";
import {
  ensureSchema,
  ensureAdminUser,
  getLastSchemaError,
  getLastAdminError,
  isSchemaReady,
  isAdminReady,
} from "@/lib/ensureSchema";

/**
 * Diagnostic endpoint for checking database connectivity and schema
 * state. Unauthenticated on purpose: if you can't log in, you need a
 * way to find out why. It only reports schema / connection status, no
 * user data.
 *
 * Hit this URL in a browser after a failed login:
 *   https://your-deployment.example.com/api/health
 */
interface HealthReport {
  timestamp: string;
  databaseUrlConfigured: boolean;
  databaseUrlEnvVar: string | null;
  databaseHost: string | null;
  driver: "neon-http" | "postgres-js" | null;
  canConnect: boolean;
  schemaReady: boolean;
  adminReady: boolean;
  tablesPresent: Record<string, boolean>;
  errors: {
    connect: string | null;
    schema: string | null;
    admin: string | null;
  };
}

export async function GET() {
  const resolved = resolveDatabaseUrl();

  const report: HealthReport = {
    timestamp: new Date().toISOString(),
    databaseUrlConfigured: resolved !== null,
    databaseUrlEnvVar: resolved?.source ?? null,
    databaseHost: null,
    driver: null,
    canConnect: false,
    schemaReady: false,
    adminReady: false,
    tablesPresent: {},
    errors: {
      connect: null,
      schema: null,
      admin: null,
    },
  };

  // Extract DB host (without credentials) for display.
  if (resolved) {
    try {
      const u = new URL(resolved.url);
      report.databaseHost = u.host;
      report.driver = u.host.endsWith(".neon.tech")
        ? "neon-http"
        : "postgres-js";
    } catch {
      /* invalid URL */
    }
  }

  // Step 1: can we even execute a SELECT 1?
  try {
    await db.execute(sql`SELECT 1`);
    report.canConnect = true;
  } catch (e) {
    report.errors.connect = e instanceof Error ? e.message : String(e);
    return NextResponse.json(report, { status: 503 });
  }

  // Step 2: does the schema exist / can we create it?
  try {
    await ensureSchema();
  } catch (e) {
    report.errors.schema = e instanceof Error ? e.message : String(e);
  }
  report.schemaReady = isSchemaReady();
  if (!report.errors.schema) {
    report.errors.schema = getLastSchemaError();
  }

  // Step 3: is the seeded admin user in place?
  try {
    await ensureAdminUser();
  } catch (e) {
    report.errors.admin = e instanceof Error ? e.message : String(e);
  }
  report.adminReady = isAdminReady();
  if (!report.errors.admin) {
    report.errors.admin = getLastAdminError();
  }

  // Step 4: per-table presence check so it's immediately obvious
  // which table is missing on a half-migrated Supabase setup.
  const expectedTables = [
    "manufacturers",
    "users",
    "projects",
    "project_constants",
    "product_lines",
    "account_requests",
    "audit_logs",
    "user_manufacturers",
  ];
  for (const tbl of expectedTables) {
    try {
      await db.execute(
        sql.raw(
          `SELECT 1 FROM information_schema.tables ` +
            `WHERE table_schema = 'public' AND table_name = '${tbl}' LIMIT 1`
        )
      );
      // information_schema query succeeded — but we need to actually
      // probe the table to confirm it exists & is readable.
      await db.execute(sql.raw(`SELECT 1 FROM ${tbl} LIMIT 1`));
      report.tablesPresent[tbl] = true;
    } catch {
      report.tablesPresent[tbl] = false;
    }
  }

  const ok =
    report.canConnect &&
    report.schemaReady &&
    report.adminReady &&
    Object.values(report.tablesPresent).every(Boolean);

  return NextResponse.json(report, { status: ok ? 200 : 503 });
}
