"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Activity,
  User as UserIcon,
  ShieldAlert,
  Search,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditLog {
  id: number;
  actorUserId: number | null;
  actorUsername: string | null;
  actorName: string | null;
  action: string;
  entityType: string | null;
  entityId: number | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

const actionColor = (action: string) => {
  if (action === "login") return "bg-emerald-50 text-emerald-700";
  if (action === "login_failed") return "bg-rose-50 text-rose-700";
  if (action === "logout") return "bg-gray-100 text-gray-600";
  if (action === "create") return "bg-cyan-50 text-cyan-700";
  if (action === "update") return "bg-amber-50 text-amber-700";
  if (action === "delete") return "bg-rose-50 text-rose-700";
  return "bg-gray-100 text-gray-600";
};

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/logs");
      if (res.ok) {
        setLogs(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = query
    ? logs.filter((l) => {
        const q = query.toLowerCase();
        return (
          l.action.toLowerCase().includes(q) ||
          (l.actorUsername ?? "").toLowerCase().includes(q) ||
          (l.actorName ?? "").toLowerCase().includes(q) ||
          (l.entityType ?? "").toLowerCase().includes(q) ||
          (l.details ?? "").toLowerCase().includes(q)
        );
      })
    : logs;

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-10 sm:px-6">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm">
        <Link
          href="/admin"
          className="flex items-center gap-1 text-gray-400 transition-colors hover:text-gray-700"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Admin
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-700">Activity Logs</span>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-cyan-600">
            <Activity className="h-3.5 w-3.5" />
            Audit Trail
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Activity Logs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Every login, create, update, and delete across the workspace.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by user, action, entity, details…"
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-800 placeholder-gray-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition-colors"
        />
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-gray-200 border-t-cyan-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-16 text-center">
          <ShieldAlert className="mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500">No log entries found</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3">Time</th>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Entity</th>
                <th className="px-5 py-3">Details</th>
                <th className="px-5 py-3">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                  <td className="whitespace-nowrap px-5 py-3 text-xs text-gray-500">
                    {new Date(l.createdAt).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-gray-800">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-50 text-cyan-600">
                        <UserIcon className="h-3 w-3" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {l.actorName ?? "—"}
                        </div>
                        <div className="truncate text-xs text-gray-400">
                          {l.actorUsername ?? "anonymous"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        actionColor(l.action)
                      )}
                    >
                      {l.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {l.entityType ? (
                      <span>
                        {l.entityType}
                        {l.entityId != null && (
                          <span className="text-gray-400"> #{l.entityId}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="max-w-xs px-5 py-3 text-xs text-gray-500">
                    <div className="truncate" title={l.details ?? ""}>
                      {l.details ?? "—"}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-xs text-gray-400">
                    {l.ipAddress ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
