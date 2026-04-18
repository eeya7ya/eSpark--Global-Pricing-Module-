import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

type DrizzleDb =
  | ReturnType<typeof drizzleNeon<typeof schema>>
  | ReturnType<typeof drizzlePg<typeof schema>>;

let _db: DrizzleDb | null = null;

/**
 * Names we will read a Postgres connection string from, in priority
 * order. DATABASE_URL is the canonical one. The POSTGRES_* names are
 * what Vercel's Supabase integration auto-populates (and POSTGRES_URL
 * there is the pooled transaction URL, which is the one we want for
 * serverless).
 */
const URL_ENV_KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL", // Vercel+Supabase: pooled (port 6543)
  "POSTGRES_PRISMA_URL", // Vercel+Supabase: pooled + Prisma flags (fine too)
  "POSTGRES_URL_NON_POOLING", // Vercel+Supabase: direct (port 5432) — last resort
] as const;

export function resolveDatabaseUrl(): { url: string; source: string } | null {
  for (const key of URL_ENV_KEYS) {
    const v = process.env[key];
    if (v && v.trim()) return { url: v, source: key };
  }
  return null;
}

/**
 * Pick the right driver based on the connection URL:
 *  - *.neon.tech URLs → Neon's HTTP driver (best for serverless on Vercel).
 *  - Everything else (Supabase, plain Postgres, RDS, Docker…) → postgres.js
 *    over the standard PostgreSQL wire protocol.
 *
 * This lets you migrate databases just by changing the env var — no code
 * change needed.
 */
function isNeonUrl(url: string): boolean {
  try {
    const host = new URL(url).host;
    return host.endsWith(".neon.tech") || host.endsWith(".neon.database.io");
  } catch {
    return false;
  }
}

export function getDb(): DrizzleDb {
  if (!_db) {
    const resolved = resolveDatabaseUrl();
    if (!resolved) {
      throw new Error(
        "No database URL is set. Expected one of: " +
          URL_ENV_KEYS.join(", ")
      );
    }
    const url = resolved.url;

    if (isNeonUrl(url)) {
      const sql = neon(url);
      _db = drizzleNeon(sql, { schema });
    } else {
      // Standard PostgreSQL (Supabase, self-hosted, RDS, etc.).
      // `prepare: false` keeps us compatible with Supabase's transaction-
      // mode pooler (pgbouncer doesn't support prepared statements).
      const client = postgres(url, { prepare: false });
      _db = drizzlePg(client, { schema });
    }
  }
  return _db;
}

// Convenience re-export — lazy proxy so the connection isn't opened until first call
export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop) {
    const instance = getDb();
    return (instance as any)[prop];
  },
});
