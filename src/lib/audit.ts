import { db } from "./db";
import { auditLogs } from "@/db/schema";
import type { AuthUser } from "./auth";

export interface AuditEntry {
  actor?: AuthUser | null;
  actorUsername?: string | null;
  actorName?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: number | null;
  details?: Record<string, unknown> | string | null;
  ipAddress?: string | null;
}

/**
 * Fire-and-forget audit log writer. Never throws — logging must not
 * break the user-facing request. Pass `actor` when you have an
 * authenticated user, or `actorUsername` for anonymous actions
 * (login attempts).
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const details =
      entry.details == null
        ? null
        : typeof entry.details === "string"
        ? entry.details
        : JSON.stringify(entry.details);

    await db.insert(auditLogs).values({
      actorUserId: entry.actor?.id ?? null,
      actorUsername: entry.actor?.username ?? entry.actorUsername ?? null,
      actorName: entry.actor?.fullName ?? entry.actorName ?? null,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      details,
      ipAddress: entry.ipAddress ?? null,
    });
  } catch (e) {
    console.error("[audit] write failed:", e);
  }
}

export function getClientIp(req: Request): string | null {
  const h = req.headers;
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") ?? null;
}
