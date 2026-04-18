"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Factory, Pencil, Check, X } from "lucide-react";
import { PricingSheet } from "@/components/PricingSheet";
import { GlobalProjectSearch } from "@/components/GlobalProjectSearch";
import { ManufacturerBackup } from "@/components/ManufacturerBackup";

interface Manufacturer {
  id: number;
  name: string;
}

export default function ManufacturerPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = parseInt(params.id as string);

  const [manufacturer, setManufacturer] = useState<Manufacturer | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");

  // Project id taken from ?project= (set by global search) — lets the
  // PricingSheet auto-open a specific project on mount or on switch.
  const initialProjectParam = searchParams.get("project");
  const [requestedProjectId, setRequestedProjectId] = useState<number | null>(
    initialProjectParam ? parseInt(initialProjectParam, 10) : null
  );

  // Owner scope: when admin opens this manufacturer from a specific user's
  // card we want to show only that user's projects, not every project under
  // the manufacturer. The owning user id arrives as ?owner= from the card
  // link or from global search navigation.
  const ownerParam = searchParams.get("owner");
  const ownerUserId = ownerParam ? parseInt(ownerParam, 10) : null;

  // Counter bumped after a backup restore to force PricingSheet to
  // re-fetch its project list.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/manufacturers/${id}`);
        if (!res.ok) {
          router.push("/");
          return;
        }
        const data = await res.json();
        setManufacturer(data);
        setEditName(data.name);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleSaveName = async () => {
    if (!editName.trim() || !manufacturer) return;
    const res = await fetch(`/api/manufacturers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    if (res.ok) {
      const updated = await res.json();
      setManufacturer(updated);
    }
    setEditing(false);
  };

  // Don't block render — show shell immediately, skeleton the name until loaded
  if (!loading && !manufacturer) return null;

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm">
        <Link
          href="/"
          className="flex items-center gap-1 text-gray-400 transition-colors hover:text-gray-700"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Dashboard
        </Link>
        <span className="text-gray-300">/</span>
        {loading ? (
          <span className="h-4 w-32 animate-pulse rounded bg-gray-200" />
        ) : (
          <span className="text-gray-700">{manufacturer!.name}</span>
        )}
      </div>

      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 ring-1 ring-cyan-200">
            <Factory className="h-5 w-5 text-cyan-600" />
          </div>

          {loading ? (
            <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-200" />
          ) : editing ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") {
                    setEditing(false);
                    setEditName(manufacturer!.name);
                  }
                }}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-lg font-bold text-gray-900 focus:border-cyan-400 focus:outline-none"
              />
              <button
                onClick={handleSaveName}
                className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditName(manufacturer!.name);
                }}
                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{manufacturer!.name}</h1>
              <button
                onClick={() => setEditing(true)}
                className="rounded-md p-1.5 text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Search + backup toolbar */}
        {!loading && manufacturer && (
          <div className="flex flex-wrap items-center gap-3">
            <GlobalProjectSearch
              currentManufacturerId={id}
              currentOwnerUserId={ownerUserId}
              onLocalSelect={(projectId) => {
                // Update the URL so refreshes stay on the same project.
                // Using window.history.replaceState (instead of
                // router.replace) avoids re-running the Next.js route —
                // router.replace was triggering a full page re-render and
                // freezing the UI while the search dropdown was still
                // visible.
                if (typeof window !== "undefined") {
                  const params = new URLSearchParams(window.location.search);
                  params.set("project", String(projectId));
                  window.history.replaceState(
                    null,
                    "",
                    `${window.location.pathname}?${params.toString()}`
                  );
                }
                setRequestedProjectId(projectId);
              }}
            />
            <ManufacturerBackup
              manufacturerId={id}
              manufacturerName={manufacturer.name}
              ownerUserId={ownerUserId}
              onRestored={() => setReloadKey((k) => k + 1)}
            />
          </div>
        )}
      </div>

      {/* Pricing sheet — renders immediately, loads its own data in parallel */}
      <PricingSheet
        manufacturerId={id}
        manufacturerName={manufacturer?.name ?? ""}
        initialProjectId={requestedProjectId}
        reloadKey={reloadKey}
        ownerUserId={ownerUserId}
      />
    </div>
  );
}
