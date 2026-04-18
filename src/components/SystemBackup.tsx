"use client";

import { useRef, useState } from "react";
import {
  Download,
  Upload,
  Loader2,
  Database,
  AlertTriangle,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Admin-only full-system backup/restore toolbar.
 *
 * The backup covers EVERY table (users, manufacturers, projects,
 * product lines, audit logs, etc.) so you can safely migrate the app
 * to a different database without losing anything.
 *
 * Restore is intentionally strict: the server refuses to run if the
 * target database already has any real data in it, so you can't
 * accidentally overwrite the live database by clicking the wrong
 * button.
 */
export function SystemBackup() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingSummary, setPendingSummary] = useState<{
    counts: Record<string, number>;
    total: number;
  } | null>(null);
  const [status, setStatus] = useState<
    | { kind: "success"; text: string }
    | { kind: "error"; text: string }
    | null
  >(null);

  const clearStatusSoon = () => {
    setTimeout(() => setStatus(null), 6000);
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/system-backup");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pricing-sheet-system-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus({
        kind: "success",
        text: "Full system backup downloaded. Keep this file safe — it contains password hashes.",
      });
      clearStatusSoon();
    } catch (e) {
      setStatus({ kind: "error", text: (e as Error).message });
      clearStatusSoon();
    } finally {
      setExporting(false);
    }
  };

  const handleFilePicked = async (file: File) => {
    try {
      const text = await file.text();
      let payload: any;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error("Selected file is not valid JSON.");
      }
      if (!payload || typeof payload !== "object" || !payload.tables) {
        throw new Error(
          "That file doesn't look like a full system backup."
        );
      }
      const t = payload.tables;
      const counts: Record<string, number> = {
        manufacturers: Array.isArray(t.manufacturers)
          ? t.manufacturers.length
          : 0,
        users: Array.isArray(t.users) ? t.users.length : 0,
        userManufacturers: Array.isArray(t.userManufacturers)
          ? t.userManufacturers.length
          : 0,
        projects: Array.isArray(t.projects) ? t.projects.length : 0,
        projectConstants: Array.isArray(t.projectConstants)
          ? t.projectConstants.length
          : 0,
        productLines: Array.isArray(t.productLines)
          ? t.productLines.length
          : 0,
        accountRequests: Array.isArray(t.accountRequests)
          ? t.accountRequests.length
          : 0,
        auditLogs: Array.isArray(t.auditLogs) ? t.auditLogs.length : 0,
      };
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      setPendingFile(file);
      setPendingSummary({ counts, total });
      setStatus(null);
    } catch (e) {
      setStatus({ kind: "error", text: (e as Error).message });
      clearStatusSoon();
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const confirmImport = async () => {
    if (!pendingFile || importing) return;
    setImporting(true);
    setStatus(null);
    try {
      const text = await pendingFile.text();
      const res = await fetch("/api/admin/system-backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Restore failed.");
      }
      const total: number = Object.values(
        (data.counts ?? {}) as Record<string, number>
      ).reduce((a, b) => a + b, 0);
      setStatus({
        kind: "success",
        text: `Restored ${total} rows across ${
          Object.keys(data.counts ?? {}).length
        } tables. You will need to sign in again.`,
      });
      setPendingFile(null);
      setPendingSummary(null);
      clearStatusSoon();
    } catch (e) {
      setStatus({ kind: "error", text: (e as Error).message });
      clearStatusSoon();
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100">
          <Database className="h-4 w-4 text-amber-700" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-gray-900">
            Full System Backup
          </h2>
          <p className="mt-0.5 text-xs text-gray-600">
            Download a single file containing <em>every</em> row in the
            database — users, manufacturers, projects, product lines,
            audit logs. Use it to migrate the app to a different
            database without losing any data. Restore only runs against
            an empty database.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFilePicked(file);
              }}
            />

            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-60"
            >
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Download Full Backup
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:border-amber-300 hover:bg-amber-50 disabled:opacity-60"
            >
              <Upload className="h-3.5 w-3.5" />
              Restore Into Empty Database
            </button>

            {status && (
              <span
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium",
                  status.kind === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-rose-50 text-rose-700"
                )}
              >
                {status.kind === "success" ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <AlertTriangle className="h-3 w-3" />
                )}
                {status.text}
              </span>
            )}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-amber-800">
            <strong>Heads up:</strong> the backup file contains password
            hashes — treat it like a password database. After restoring
            on the new server, sign in again using your existing
            credentials.
          </p>
        </div>
      </div>

      {/* Restore confirmation modal */}
      {pendingFile && pendingSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-8 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Confirm Full Restore
              </h3>
              <button
                onClick={() => {
                  setPendingFile(null);
                  setPendingSummary(null);
                }}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-4 text-sm text-gray-600">
              About to restore{" "}
              <strong className="text-gray-900">
                {pendingSummary.total} rows
              </strong>{" "}
              from <span className="font-mono text-xs">{pendingFile.name}</span>{" "}
              into the database this app is currently pointed at.
            </p>

            <div className="mb-5 rounded-xl border border-gray-100 bg-gray-50 p-3">
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                {Object.entries(pendingSummary.counts).map(([k, v]) => (
                  <li
                    key={k}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-gray-500">{k}</span>
                    <span className="font-mono font-semibold text-gray-800">
                      {v}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="font-semibold">This will only work if the target database is empty.</p>
              <p className="mt-1">
                If anyone else has created data on this database, the
                restore will be refused. Your current admin session will
                stop working after the import — sign in again using
                credentials from the backed-up system.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setPendingFile(null);
                  setPendingSummary(null);
                }}
                disabled={importing}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={confirmImport}
                disabled={importing}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-600 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Restoring…
                  </>
                ) : (
                  "Restore Now"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
