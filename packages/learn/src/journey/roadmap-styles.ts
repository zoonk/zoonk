import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";

/* In a module of their own so server components (the public pages) can draw the bands too. */

export const BAND_STATE_CLASS: Record<PlanPhaseView["state"], string> = {
  current: "bg-surface-3 text-foreground ring-success ring-[1.5px] ring-inset",
  done: "bg-success/13 text-success-text",
  leftOut: "bg-muted text-muted-foreground",
  unfinished: "bg-muted text-muted-foreground",
  upcoming: "bg-muted text-muted-foreground",
};

/** Fills its column, so a band whose name takes two lines makes every band in the row as tall. */
export const BAND_CLASS =
  "relative flex min-h-8 min-w-18 flex-1 items-center gap-1 rounded-md px-2.5 py-1 text-left text-[0.78125rem] font-medium";

export const BAND_NAME_CLASS = "min-w-0 leading-4 text-balance hyphens-auto";

/** Inline in the name, so a narrow band's lines get its whole width. */
export const BAND_CHECK_CLASS = "mr-1 inline size-3.5 align-[-0.1875rem]";

/**
 * A band is drawn to its time but never narrower than its name's longest word, so the column
 * can't be a size container (that would give it no width of its own): the axis under it is.
 */
export const BAND_COLUMN_CLASS = "relative flex min-w-min basis-0 flex-col";

export const AXIS_CLASS = "@container/phase relative block h-4";

export const AXIS_LABEL_CLASS =
  "text-faint absolute top-0 font-mono text-[0.6875rem] leading-4 whitespace-nowrap tabular-nums";
