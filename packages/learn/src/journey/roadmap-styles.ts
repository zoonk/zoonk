import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";

/* In a module of their own so server components (the public pages) can draw the bands too. */

export const BAND_STATE_CLASS: Record<PlanPhaseView["state"], string> = {
  current: "bg-surface-3 text-foreground ring-success ring-[1.5px] ring-inset",
  done: "bg-success/13 text-success-text",
  leftOut: "bg-muted text-muted-foreground",
  unfinished: "bg-muted text-muted-foreground",
  upcoming: "bg-muted text-muted-foreground",
};

export const BAND_CLASS =
  "relative flex h-8 w-full min-w-0 items-center gap-1 rounded-md px-2.5 text-left text-[0.78125rem] font-medium";

export const AXIS_LABEL_CLASS =
  "text-faint absolute top-0 font-mono text-[0.6875rem] leading-4 whitespace-nowrap tabular-nums";
