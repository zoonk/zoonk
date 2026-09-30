import { type DiagramTone } from "./diagram-types";

type ToneClasses = { area: string; mark: string; soft: string; stroke: string };

/**
 * Drawings keep natural colors (red and blue blood, green leaves), so they use color families
 * instead of the data tokens. Fills are tints mixed into the page background and strokes are
 * mixed toward the text color, so every tone follows light, dark and Fun's paper on its own and
 * outlines keep at least 3:1 against the surface.
 */
export const DIAGRAM_TONES: Record<DiagramTone, ToneClasses> = {
  blue: {
    area: "fill-[color-mix(in_oklab,var(--color-blue-500)_32%,var(--background))]",
    mark: "fill-[color-mix(in_oklab,var(--color-blue-600)_80%,var(--foreground))]",
    soft: "fill-[color-mix(in_oklab,var(--color-blue-500)_14%,var(--background))]",
    stroke: "stroke-[color-mix(in_oklab,var(--color-blue-600)_78%,var(--foreground))]",
  },
  brown: {
    area: "fill-[color-mix(in_oklab,var(--color-amber-700)_32%,var(--background))]",
    mark: "fill-[color-mix(in_oklab,var(--color-amber-800)_80%,var(--foreground))]",
    soft: "fill-[color-mix(in_oklab,var(--color-amber-700)_14%,var(--background))]",
    stroke: "stroke-[color-mix(in_oklab,var(--color-amber-800)_78%,var(--foreground))]",
  },
  gray: {
    area: "fill-[color-mix(in_oklab,var(--color-slate-400)_32%,var(--background))]",
    mark: "fill-[color-mix(in_oklab,var(--color-slate-600)_80%,var(--foreground))]",
    soft: "fill-[color-mix(in_oklab,var(--color-slate-400)_14%,var(--background))]",
    stroke: "stroke-[color-mix(in_oklab,var(--color-slate-600)_78%,var(--foreground))]",
  },
  green: {
    area: "fill-[color-mix(in_oklab,var(--color-green-500)_32%,var(--background))]",
    mark: "fill-[color-mix(in_oklab,var(--color-green-700)_80%,var(--foreground))]",
    soft: "fill-[color-mix(in_oklab,var(--color-green-500)_14%,var(--background))]",
    stroke: "stroke-[color-mix(in_oklab,var(--color-green-700)_78%,var(--foreground))]",
  },
  lime: {
    area: "fill-[color-mix(in_oklab,var(--color-lime-500)_32%,var(--background))]",
    mark: "fill-[color-mix(in_oklab,var(--color-lime-700)_80%,var(--foreground))]",
    soft: "fill-[color-mix(in_oklab,var(--color-lime-500)_14%,var(--background))]",
    stroke: "stroke-[color-mix(in_oklab,var(--color-lime-700)_78%,var(--foreground))]",
  },
  orange: {
    area: "fill-[color-mix(in_oklab,var(--color-orange-500)_32%,var(--background))]",
    mark: "fill-[color-mix(in_oklab,var(--color-orange-600)_80%,var(--foreground))]",
    soft: "fill-[color-mix(in_oklab,var(--color-orange-500)_14%,var(--background))]",
    stroke: "stroke-[color-mix(in_oklab,var(--color-orange-600)_78%,var(--foreground))]",
  },
  pink: {
    area: "fill-[color-mix(in_oklab,var(--color-pink-400)_32%,var(--background))]",
    mark: "fill-[color-mix(in_oklab,var(--color-pink-600)_80%,var(--foreground))]",
    soft: "fill-[color-mix(in_oklab,var(--color-pink-400)_14%,var(--background))]",
    stroke: "stroke-[color-mix(in_oklab,var(--color-pink-600)_78%,var(--foreground))]",
  },
  purple: {
    area: "fill-[color-mix(in_oklab,var(--color-violet-500)_32%,var(--background))]",
    mark: "fill-[color-mix(in_oklab,var(--color-violet-600)_80%,var(--foreground))]",
    soft: "fill-[color-mix(in_oklab,var(--color-violet-500)_14%,var(--background))]",
    stroke: "stroke-[color-mix(in_oklab,var(--color-violet-600)_78%,var(--foreground))]",
  },
  red: {
    area: "fill-[color-mix(in_oklab,var(--color-red-500)_32%,var(--background))]",
    mark: "fill-[color-mix(in_oklab,var(--color-red-600)_80%,var(--foreground))]",
    soft: "fill-[color-mix(in_oklab,var(--color-red-500)_14%,var(--background))]",
    stroke: "stroke-[color-mix(in_oklab,var(--color-red-600)_78%,var(--foreground))]",
  },
  sky: {
    area: "fill-[color-mix(in_oklab,var(--color-sky-400)_32%,var(--background))]",
    mark: "fill-[color-mix(in_oklab,var(--color-sky-600)_80%,var(--foreground))]",
    soft: "fill-[color-mix(in_oklab,var(--color-sky-400)_14%,var(--background))]",
    stroke: "stroke-[color-mix(in_oklab,var(--color-sky-600)_78%,var(--foreground))]",
  },
  teal: {
    area: "fill-[color-mix(in_oklab,var(--color-teal-500)_32%,var(--background))]",
    mark: "fill-[color-mix(in_oklab,var(--color-teal-700)_80%,var(--foreground))]",
    soft: "fill-[color-mix(in_oklab,var(--color-teal-500)_14%,var(--background))]",
    stroke: "stroke-[color-mix(in_oklab,var(--color-teal-700)_78%,var(--foreground))]",
  },
  yellow: {
    area: "fill-[color-mix(in_oklab,var(--color-yellow-400)_32%,var(--background))]",
    mark: "fill-[color-mix(in_oklab,var(--color-yellow-600)_80%,var(--foreground))]",
    soft: "fill-[color-mix(in_oklab,var(--color-yellow-400)_14%,var(--background))]",
    stroke: "stroke-[color-mix(in_oklab,var(--color-yellow-600)_78%,var(--foreground))]",
  },
};
