"use client";

import Link from "next/link";
import { Factory, FolderOpen, ArrowUpRight, Trash2, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { getManufacturerColor } from "@/lib/manufacturerColors";

interface Props {
  id: number;
  name: string;
  color?: string | null;
  tag?: string | null;
  projectCount: number;
  /** Owner this card represents. For admins the same manufacturer can appear
   *  multiple times (once per user), so we scope the link by owner to keep
   *  projects isolated per user. */
  ownerUserId?: number | null;
  onDelete?: (id: number) => void;
}

export function ManufacturerCard({
  id,
  name,
  color,
  tag,
  projectCount,
  ownerUserId,
  onDelete,
}: Props) {
  const palette = getManufacturerColor(color);
  const href =
    ownerUserId != null
      ? `/manufacturer/${id}?owner=${ownerUserId}`
      : `/manufacturer/${id}`;

  return (
    <div
      className={cn(
        "group surface-card relative overflow-hidden p-5",
        "hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(99,102,241,0.18)]"
      )}
    >
      {/* Top gradient bar — category accent */}
      <span
        className={cn(
          "absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
          palette.gradientFrom,
          palette.gradientTo
        )}
      />

      {/* Delete button (admin only) */}
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            if (confirm(`Delete "${name}" and all its data?`)) {
              onDelete(id);
            }
          }}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-rose-100 hover:text-rose-500"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Icon well — gradient tile */}
      <div
        className={cn(
          "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-[0_8px_30px_rgba(99,102,241,0.25)]",
          palette.gradientFrom,
          palette.gradientTo
        )}
      >
        <Factory className="h-6 w-6" />
      </div>

      {/* Name + tag */}
      <h3 className="mb-1.5 text-lg font-semibold tracking-tight text-gray-900">
        {name}
      </h3>
      {tag ? (
        <div
          className={cn(
            "mb-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
            palette.tagBg,
            palette.tagText
          )}
        >
          <Tag className="h-2.5 w-2.5" />
          {tag}
        </div>
      ) : null}

      {/* Stats */}
      <div className="mb-5 flex items-center gap-1.5 text-xs text-gray-500">
        <FolderOpen className="h-3.5 w-3.5" />
        {projectCount} {projectCount === 1 ? "project" : "projects"}
      </div>

      {/* Open link */}
      <Link
        href={href}
        className={cn(
          "flex items-center justify-between rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5",
          "text-sm font-medium text-gray-700",
          "transition-all hover:border-indigo-500/60 hover:text-indigo-400"
        )}
      >
        <span>Open Sheet</span>
        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}
