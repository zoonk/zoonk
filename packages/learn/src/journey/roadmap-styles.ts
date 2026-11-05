import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { type CSSProperties } from "react";

/* In a module of their own so server components (the public pages) can draw the bands too. */

export const BAND_STATE_CLASS: Record<PlanPhaseView["state"], string> = {
  current: "bg-surface-3 text-foreground ring-success ring-[1.5px] ring-inset",
  done: "bg-success/13 text-success-text",
  leftOut: "bg-muted text-muted-foreground",
  unfinished: "bg-muted text-muted-foreground",
  upcoming: "bg-muted text-muted-foreground",
};

export const BAND_CLASS =
  "relative flex min-h-8 min-w-min items-center gap-1 rounded-md px-2.5 py-1 text-left text-[0.78125rem] font-medium";

export const BAND_NAME_CLASS = "min-w-0 leading-4 text-balance hyphens-auto";

/** Inline in the name, so a narrow band's lines get its whole width. */
export const BAND_CHECK_CLASS = "mr-1 inline size-3.5 align-[-0.1875rem]";

/**
 * The columns share their rows, so every band is as tall as the one whose name takes the most
 * lines, and one phase's labels taking two lines leaves the bands alike.
 */
export const BAND_ROWS_CLASS = "grid gap-x-[3px]";

/**
 * The floor is on the column, not the band: a grid sizes a column by the band's minimum width
 * when it has one, so a long word in the name would no longer widen it.
 */
export const BAND_COLUMN_CLASS = "relative row-span-full grid min-w-18 grid-rows-subgrid";

/**
 * A band is drawn to its time but never narrower than its name's longest word, so the column
 * can't be a size container (that would give it no width of its own): the axis under it is.
 */
export function getBandColumnsStyle(weights: readonly number[]): CSSProperties {
  return {
    gridTemplateColumns: weights.map((weight) => `minmax(min-content, ${weight}fr)`).join(" "),
  };
}

export const AXIS_CLASS = "@container/phase relative flex min-h-4 flex-wrap";

export const AXIS_TEXT_CLASS =
  "text-faint font-mono text-[0.6875rem] leading-4 whitespace-nowrap tabular-nums";

const MIDDLE_SHARE = 0.5;

const PERCENT = 100;

/**
 * Right-aligned so a label with no room after its point moves back inside the phase; one ending at
 * its point is at least as wide as its text, so it never starts before the phase does.
 */
export const AXIS_POINT_CLASS = "flex max-w-full justify-end";

export function getPointSide(share: number): "left" | "right" {
  return share < MIDDLE_SHARE ? "left" : "right";
}

export function getAxisPointStyle(share: number): CSSProperties {
  const at = `${share * PERCENT}%`;

  return getPointSide(share) === "left"
    ? { paddingLeft: at }
    : { minWidth: "fit-content", width: at };
}

/** Right-aligned so a label wider than the phase runs left, not past the roadmap's edge. */
export const AXIS_END_CLASS = "ml-auto flex max-w-full justify-end pl-2";
