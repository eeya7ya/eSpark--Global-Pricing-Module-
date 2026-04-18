"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Save, Plus, Trash2, Download, FileSpreadsheet, Printer, FolderMinus } from "lucide-react";
import { ProjectSelector } from "./ProjectSelector";
import { ConstantsPanel } from "./ConstantsPanel";
import { ProductTable } from "./ProductTable";
import { PricingCharts } from "./PricingCharts";
import { type Constants, DEFAULT_CONSTANTS } from "@/lib/calculations";
import { exportToCsv, exportToPrint } from "@/lib/export";

interface Project {
  id: number;
  name: string;
  date?: string | null;
  responsiblePerson?: string | null;
}

interface ProductRow {
  id: number;
  position: number;
  itemModel: string;
  priceUsd: number;
  quantity: number;
  shippingOverride?: number | null;
  customsOverride?: number | null;
  shippingRateOverride?: number | null;
  customsRateOverride?: number | null;
  profitRateOverride?: number | null;
}

interface Props {
  manufacturerId: number;
  manufacturerName: string;
  /** If set, the sheet tries to auto-select this project id after load
   *  (overrides the default first-project auto-select). Changing this
   *  value at runtime also switches selection. */
  initialProjectId?: number | null;
  /** Increment this number from the parent to force a refresh of the
   *  project list (e.g. after a backup restore). */
  reloadKey?: number;
  /** Admin-only: scopes the projects view to a specific owning user so the
   *  same manufacturer viewed from two different user cards shows two
   *  separate project lists. */
  ownerUserId?: number | null;
}

export function PricingSheet({
  manufacturerId,
  manufacturerName,
  initialProjectId,
  reloadKey = 0,
  ownerUserId,
}: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [constants, setConstants] = useState<Constants>(DEFAULT_CONSTANTS);
  const [targetCurrency, setTargetCurrency] = useState("JOD");
  const [sourceCurrency, setSourceCurrency] = useState("USD");
  const [rows, setRows] = useState<ProductRow[]>([]);
  // Start in a loading state so we don't flash the "No project selected"
  // empty state on first paint while the projects list is still in-flight.
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Editable project meta
  const [projectName, setProjectName] = useState("");
  const [projectDate, setProjectDate] = useState("");
  const [responsiblePerson, setResponsiblePerson] = useState("");

  // Track whether we've done the initial project auto-select
  const initialSelectDone = useRef(false);

  // Keep the latest initialProjectId in a ref so loadProjects can read it
  // without being added to its dependency list — otherwise we'd re-fetch
  // the whole project list (and re-render everything) on every search
  // result click, which was freezing the page.
  const initialProjectIdRef = useRef<number | null | undefined>(initialProjectId);
  useEffect(() => {
    initialProjectIdRef.current = initialProjectId;
  }, [initialProjectId]);

  // Load projects list — only re-runs when manufacturerId changes or
  // when the parent bumps reloadKey (e.g. after a restore).
  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const params = new URLSearchParams({ manufacturerId: String(manufacturerId) });
      if (ownerUserId != null) params.set("ownerUserId", String(ownerUserId));
      const res = await fetch(`/api/projects?${params.toString()}`);
      if (res.ok) {
        const data: Project[] = await res.json();
        setProjects(data);
        // Auto-select on initial load. If the parent gave us an
        // initialProjectId we honour it; otherwise pick the first.
        if (!initialSelectDone.current && data.length > 0) {
          initialSelectDone.current = true;
          const wantId = initialProjectIdRef.current;
          const preferred =
            wantId != null && data.some((p) => p.id === wantId)
              ? wantId
              : data[0].id;
          setSelectedProjectId(preferred);
        }
      }
    } finally {
      setProjectsLoading(false);
    }
  }, [manufacturerId, ownerUserId]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects, reloadKey]);

  // If the parent supplies a new initialProjectId at runtime (e.g. user
  // picked a result from global search), switch to it without losing
  // unsaved edits to the current project.
  useEffect(() => {
    if (initialProjectId == null) return;
    if (initialProjectId === selectedProjectId) return;
    // Only honour it when the project is in our loaded list.
    if (projects.some((p) => p.id === initialProjectId)) {
      setSelectedProjectId(initialProjectId);
    }
  }, [initialProjectId, projects, selectedProjectId]);

  // Load project data when selection changes
  useEffect(() => {
    if (!selectedProjectId) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/projects/${selectedProjectId}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();

        if (cancelled) return;

        if (data.project) {
          setProjectName(data.project.name ?? "");
          setProjectDate(data.project.date ?? "");
          setResponsiblePerson(data.project.responsiblePerson ?? "");
        }

        if (data.constants) {
          setConstants({
            currencyRate: parseFloat(data.constants.currencyRate),
            shippingRate: parseFloat(data.constants.shippingRate),
            customsRate: parseFloat(data.constants.customsRate),
            profitMargin: parseFloat(data.constants.profitMargin),
            taxRate: parseFloat(data.constants.taxRate),
          });
          setTargetCurrency(data.constants.targetCurrency ?? "JOD");
          setSourceCurrency(data.constants.sourceCurrency ?? "USD");
        }

        if (data.productLines) {
          setRows(
            data.productLines.map((l: any) => ({
              id: l.id,
              position: l.position,
              itemModel: l.itemModel,
              priceUsd: parseFloat(l.priceUsd),
              quantity: l.quantity,
              shippingOverride: l.shippingOverride != null ? parseFloat(l.shippingOverride) : null,
              customsOverride: l.customsOverride != null ? parseFloat(l.customsOverride) : null,
              shippingRateOverride: l.shippingRateOverride != null ? parseFloat(l.shippingRateOverride) : null,
              customsRateOverride: l.customsRateOverride != null ? parseFloat(l.customsRateOverride) : null,
              profitRateOverride: l.profitRateOverride != null ? parseFloat(l.profitRateOverride) : null,
            }))
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setSavedAt(null);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [selectedProjectId]);

  // Manual save
  const handleSave = useCallback(async () => {
    if (!selectedProjectId || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName,
          date: projectDate || null,
          responsiblePerson: responsiblePerson || null,
          constants: { ...constants, targetCurrency, sourceCurrency },
          productLines: rows,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.productLines) {
          setRows((prev) =>
            prev.map((r, i) =>
              data.productLines[i] ? { ...r, id: data.productLines[i].id, position: data.productLines[i].position } : r
            )
          );
        }
        setProjects((prev) =>
          prev.map((p) =>
            p.id === selectedProjectId
              ? { ...p, name: projectName, date: projectDate || null, responsiblePerson: responsiblePerson || null }
              : p
          )
        );
        setSavedAt(new Date());
      }
    } finally {
      setSaving(false);
    }
  }, [selectedProjectId, saving, projectName, projectDate, responsiblePerson, constants, targetCurrency, rows]);

  const handleCreateProject = useCallback(async (name: string) => {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, manufacturerId, ownerUserId }),
    });
    if (res.ok) {
      const project = await res.json();
      await loadProjects();
      setSelectedProjectId(project.id);
    }
  }, [manufacturerId, ownerUserId, loadProjects]);

  const handleAddRow = useCallback(() => {
    setRows((prev) => [
      ...prev,
      {
        id: Date.now(),
        position: prev.length + 1,
        itemModel: "",
        priceUsd: 0,
        quantity: 1,
      },
    ]);
  }, []);

  const handleClearRows = useCallback(() => {
    setRows((prev) => {
      if (prev.length === 0) return prev;
      if (confirm("Clear all product rows?")) return [];
      return prev;
    });
  }, []);

  const handleDeleteProject = useCallback(async () => {
    if (!selectedProjectId) return;
    const project = projects.find((p) => p.id === selectedProjectId);
    if (!confirm(`Move "${project?.name ?? "this project"}" to trash?`)) return;
    const res = await fetch(`/api/projects/${selectedProjectId}`, { method: "DELETE" });
    if (res.ok) {
      setSelectedProjectId(null);
      initialSelectDone.current = false;
      await loadProjects();
    }
  }, [selectedProjectId, projects, loadProjects]);

  const handleCurrencyChange = useCallback((code: string, rate: number) => {
    setTargetCurrency(code);
    setConstants((prev) => ({ ...prev, currencyRate: rate }));
  }, []);

  const handleSourceCurrencyChange = useCallback((code: string) => {
    setSourceCurrency(code);
  }, []);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const handleExportCsv = useCallback(() => {
    if (!selectedProject || rows.length === 0) return;
    exportToCsv(rows, constants, projectName || selectedProject.name, manufacturerName, targetCurrency, responsiblePerson);
    setShowExportMenu(false);
  }, [selectedProject, rows, constants, projectName, manufacturerName, targetCurrency, responsiblePerson]);

  const handleExportPrint = useCallback(() => {
    if (!selectedProject || rows.length === 0) return;
    exportToPrint(rows, constants, projectName || selectedProject.name, manufacturerName, targetCurrency, responsiblePerson);
    setShowExportMenu(false);
  }, [selectedProject, rows, constants, projectName, manufacturerName, targetCurrency, responsiblePerson]);

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <ProjectSelector
            projects={projects}
            selectedId={selectedProjectId}
            onSelect={setSelectedProjectId}
            onCreateNew={handleCreateProject}
          />

          {/* Editable project name + date */}
          {selectedProjectId && !loading && (
            <>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Project name…"
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              />
              <input
                type="text"
                value={responsiblePerson}
                onChange={(e) => setResponsiblePerson(e.target.value)}
                placeholder="Responsible person…"
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              />
              <input
                type="date"
                value={projectDate}
                onChange={(e) => setProjectDate(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              />
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Save status */}
          {!saving && savedAt && (
            <span className="text-xs text-gray-400">
              Saved {savedAt.toLocaleTimeString()}
            </span>
          )}

          {/* Manual Save button */}
          {selectedProjectId && !loading && (
            <>
              <button
                onClick={handleDeleteProject}
                title="Move project to trash"
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
              >
                <FolderMinus className="h-3.5 w-3.5" />
                Delete
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-cyan-400 disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          )}

          {/* Export button */}
          {selectedProjectId && rows.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowExportMenu((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
              {showExportMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowExportMenu(false)}
                  />
                  <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                    <button
                      onClick={handleExportPrint}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      <Printer className="h-3.5 w-3.5 text-gray-400" />
                      Print / Save as PDF
                    </button>
                    <button
                      onClick={handleExportCsv}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 text-gray-400" />
                      Export as CSV
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {projectsLoading || loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-cyan-500" />
        </div>
      ) : !selectedProjectId ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-gray-300">
          <div className="text-center">
            <p className="text-sm text-gray-500">No project selected</p>
            <p className="mt-1 text-xs text-gray-400">
              Use the dropdown above to select or create a project
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Constants */}
          <ConstantsPanel
            constants={constants}
            onChange={setConstants}
            saving={saving}
            sourceCurrency={sourceCurrency}
            targetCurrency={targetCurrency}
            onSourceCurrencyChange={handleSourceCurrencyChange}
            onCurrencyChange={handleCurrencyChange}
          />

          {/* Product table */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                Product Lines
              </h3>
              <div className="flex items-center gap-2">
                {rows.length > 0 && (
                  <button
                    onClick={handleClearRows}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear
                  </button>
                )}
                <button
                  onClick={handleAddRow}
                  className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-cyan-400"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Row
                </button>
              </div>
            </div>
            {rows.length === 0 ? (
              <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-gray-200">
                <div className="text-center">
                  <p className="text-sm text-gray-400">No products yet</p>
                  <button
                    onClick={handleAddRow}
                    className="mt-2 flex items-center gap-1.5 mx-auto rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-cyan-400"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Row
                  </button>
                </div>
              </div>
            ) : (
              <ProductTable
                rows={rows}
                constants={constants}
                onChange={setRows}
                targetCurrency={targetCurrency}
              />
            )}
          </div>

          {/* Charts */}
          <PricingCharts rows={rows} constants={constants} />
        </>
      )}
    </div>
  );
}
