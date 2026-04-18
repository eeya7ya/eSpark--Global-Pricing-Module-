/**
 * Palette used to visually disambiguate manufacturers that share a brand
 * name. Each entry is a tailwind class bundle so the JIT compiler picks
 * up every utility at build time (dynamic class names from a map would
 * otherwise be purged). Values are aligned with eSpark's category accents
 * (gradient-forward, dark-first).
 */
export interface ManufacturerColor {
  key: string;
  label: string;
  // Card accent (icon tile background + ring) — kept for legacy uses
  bg: string;
  ring: string;
  text: string;
  // Solid swatch (used in the color picker + small badges)
  dot: string;
  // Left border accent on the card
  border: string;
  // Gradient classes for the icon well + top accent bar (eSpark-style)
  gradientFrom: string;
  gradientTo: string;
  // Soft background for the tag label pill
  tagBg: string;
  tagText: string;
}

export const MANUFACTURER_COLORS: ManufacturerColor[] = [
  {
    key: "cyan",
    label: "Cyan",
    bg: "bg-cyan-100",
    ring: "ring-cyan-200",
    text: "text-cyan-400",
    dot: "bg-cyan-500",
    border: "border-l-cyan-400",
    gradientFrom: "from-cyan-500",
    gradientTo: "to-blue-600",
    tagBg: "bg-cyan-100",
    tagText: "text-cyan-400",
  },
  {
    key: "blue",
    label: "Blue",
    bg: "bg-blue-100",
    ring: "ring-blue-200",
    text: "text-blue-500",
    dot: "bg-blue-500",
    border: "border-l-blue-400",
    gradientFrom: "from-blue-500",
    gradientTo: "to-indigo-600",
    tagBg: "bg-blue-100",
    tagText: "text-blue-500",
  },
  {
    key: "indigo",
    label: "Indigo",
    bg: "bg-indigo-100",
    ring: "ring-indigo-200",
    text: "text-indigo-400",
    dot: "bg-indigo-500",
    border: "border-l-indigo-400",
    gradientFrom: "from-indigo-500",
    gradientTo: "to-purple-600",
    tagBg: "bg-indigo-100",
    tagText: "text-indigo-400",
  },
  {
    key: "purple",
    label: "Purple",
    bg: "bg-purple-100",
    ring: "ring-purple-200",
    text: "text-purple-500",
    dot: "bg-purple-500",
    border: "border-l-purple-400",
    gradientFrom: "from-purple-500",
    gradientTo: "to-pink-600",
    tagBg: "bg-purple-100",
    tagText: "text-purple-500",
  },
  {
    key: "pink",
    label: "Pink",
    bg: "bg-pink-100",
    ring: "ring-pink-200",
    text: "text-pink-500",
    dot: "bg-pink-500",
    border: "border-l-pink-400",
    gradientFrom: "from-pink-500",
    gradientTo: "to-rose-600",
    tagBg: "bg-pink-100",
    tagText: "text-pink-500",
  },
  {
    key: "rose",
    label: "Rose",
    bg: "bg-rose-100",
    ring: "ring-rose-200",
    text: "text-rose-500",
    dot: "bg-rose-500",
    border: "border-l-rose-400",
    gradientFrom: "from-rose-500",
    gradientTo: "to-amber-500",
    tagBg: "bg-rose-100",
    tagText: "text-rose-500",
  },
  {
    key: "amber",
    label: "Amber",
    bg: "bg-amber-100",
    ring: "ring-amber-200",
    text: "text-amber-500",
    dot: "bg-amber-500",
    border: "border-l-amber-400",
    gradientFrom: "from-amber-500",
    gradientTo: "to-orange-600",
    tagBg: "bg-amber-100",
    tagText: "text-amber-500",
  },
  {
    key: "emerald",
    label: "Emerald",
    bg: "bg-emerald-100",
    ring: "ring-emerald-200",
    text: "text-emerald-500",
    dot: "bg-emerald-500",
    border: "border-l-emerald-400",
    gradientFrom: "from-emerald-500",
    gradientTo: "to-teal-600",
    tagBg: "bg-emerald-100",
    tagText: "text-emerald-500",
  },
  {
    key: "slate",
    label: "Slate",
    bg: "bg-slate-100",
    ring: "ring-slate-200",
    text: "text-slate-500",
    dot: "bg-slate-500",
    border: "border-l-slate-400",
    gradientFrom: "from-slate-500",
    gradientTo: "to-gray-600",
    tagBg: "bg-slate-100",
    tagText: "text-slate-500",
  },
];

export const DEFAULT_MANUFACTURER_COLOR = MANUFACTURER_COLORS[0];

export function getManufacturerColor(key?: string | null): ManufacturerColor {
  if (!key) return DEFAULT_MANUFACTURER_COLOR;
  return (
    MANUFACTURER_COLORS.find((c) => c.key === key) ?? DEFAULT_MANUFACTURER_COLOR
  );
}
