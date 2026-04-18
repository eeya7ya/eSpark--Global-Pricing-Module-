"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Factory, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { ManufacturerCard } from "@/components/ManufacturerCard";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

interface ManufacturerWithCount {
  id: number;
  name: string;
  color: string | null;
  tag: string | null;
  createdAt: string;
  // The user this card belongs to. For admin, the dashboard shows one
  // card per (user, manufacturer) pair so the same brand can appear
  // multiple times — once per owning user.
  ownerUserId: number | null;
  ownerUserName: string | null;
  projectCount: number;
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";

  const [items, setItems] = useState<ManufacturerWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/manufacturers", { cache: "no-store" });
      if (res.ok) {
        const data: ManufacturerWithCount[] = await res.json();
        setItems(data);
      } else {
        const body = await res.json().catch(() => ({}));
        setItems([]);
        setLoadError(body.error ?? `Failed to load manufacturers (${res.status}).`);
      }
    } catch {
      setItems([]);
      setLoadError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return; // middleware will redirect
    loadData();
  }, [authLoading, user, loadData]);

  const resetForm = () => {
    setNewName("");
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/manufacturers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        resetForm();
        setCreating(false);
        await loadData();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to add manufacturer. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and database.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setCreating(false);
    resetForm();
    setError(null);
  };

  const handleDelete = async (id: number) => {
    // Optimistic update — remove immediately, refetch in background.
    setItems((prev) => prev.filter((m) => m.id !== id));
    try {
      await fetch(`/api/manufacturers/${id}`, { method: "DELETE" });
    } finally {
      loadData();
    }
  };

  // Admin-only "group by user" tabs — one tab per owning user.
  const userTabs = useMemo(() => {
    if (!isAdmin) return [] as { id: string; label: string }[];
    const seen = new Set<string>();
    const tabs: { id: string; label: string }[] = [];
    for (const m of items) {
      if (m.ownerUserId && m.ownerUserName) {
        const key = String(m.ownerUserId);
        if (!seen.has(key)) {
          seen.add(key);
          tabs.push({ id: key, label: m.ownerUserName });
        }
      }
    }
    return tabs;
  }, [isAdmin, items]);

  const visibleItems = useMemo(
    () =>
      isAdmin && activeTab !== "all"
        ? items.filter((m) => String(m.ownerUserId) === activeTab)
        : items,
    [isAdmin, activeTab, items]
  );

  // Wait for the auth context before deciding what to show — prevents
  // a flash of the empty state.
  const showSpinner = authLoading || loading;

  return (
    <div className="mx-auto max-w-screen-xl px-4 pb-16 pt-10 sm:px-6">
      {/* Page header */}
      <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="pill mb-5">
            <Sparkles className="h-3.5 w-3.5" />
            Global Pricing Module
          </span>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            {isAdmin ? (
              <>Precision <span className="gradient-text">Pricing</span></>
            ) : (
              <>Your <span className="gradient-text">Workspace</span></>
            )}
          </h1>
          <p className="mt-3 max-w-xl text-sm text-gray-500">
            {isAdmin
              ? "Manage every manufacturer's pricing sheet from a single control plane — with live JOD conversion, shipping, customs, and profit calculations."
              : "Your manufacturers, your pricing projects. Color and tag are yours alone — nothing crosses workspaces."}
          </p>
        </div>

        {/* Add manufacturer */}
        <div className="flex-shrink-0">
          {creating ? (
            <div className="flex flex-col items-end gap-3">
              <input
                autoFocus
                type="text"
                placeholder="Manufacturer name…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") handleCancel();
                }}
                className="focus-ring min-w-[240px] rounded-full border border-gray-200 bg-gray-50 px-5 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors"
              />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!newName.trim() || saving}
                  className="btn-gradient px-5 py-2.5 text-sm"
                >
                  {saving ? "Adding…" : "Add"}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-full border border-gray-200 bg-gray-50 px-5 py-2.5 text-sm font-medium text-gray-600 transition-all hover:border-indigo-500/50 hover:text-gray-900"
                >
                  Cancel
                </button>
              </div>
              {error && (
                <p className="flex items-center gap-1.5 text-xs text-rose-500">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {error}
                </p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="btn-gradient px-5 py-2.5 text-sm"
            >
              <Plus className="h-4 w-4" />
              Add Manufacturer
            </button>
          )}
        </div>
      </div>

      <div className="section-divider mb-8" />

      {/* User tabs (admin only) */}
      {isAdmin && userTabs.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab("all")}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
              activeTab === "all"
                ? "bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-[0_0_24px_rgba(99,102,241,0.35)]"
                : "border border-gray-200 bg-gray-50 text-gray-600 hover:border-indigo-500/50 hover:text-gray-900"
            )}
          >
            All
          </button>
          {userTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-[0_0_24px_rgba(99,102,241,0.35)]"
                  : "border border-gray-200 bg-gray-50 text-gray-600 hover:border-indigo-500/50 hover:text-gray-900"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Load error banner */}
      {loadError && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-500" />
          <p className="text-sm text-rose-500">{loadError}</p>
        </div>
      )}

      {/* Content */}
      {showSpinner ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="surface-card flex flex-col items-center justify-center rounded-3xl border-dashed py-24 text-center">
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/80 to-cyan-500/80 shadow-[0_0_40px_rgba(99,102,241,0.35)]">
            <Factory className="h-9 w-9 text-white" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-gray-900">
            No manufacturers yet
          </h3>
          <p className="mb-7 max-w-sm text-sm text-gray-500">
            Add your first manufacturer to begin building precision-driven pricing sheets.
          </p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="btn-gradient px-6 py-3 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" />
            Add Manufacturer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleItems.map((m) => (
            <div
              key={`${m.id}-${m.ownerUserId ?? "none"}`}
              className="animate-fade-in"
            >
              <ManufacturerCard
                id={m.id}
                name={m.name}
                color={m.color}
                tag={m.tag}
                projectCount={m.projectCount}
                ownerUserId={m.ownerUserId}
                onDelete={isAdmin ? handleDelete : undefined}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
