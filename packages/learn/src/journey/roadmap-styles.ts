import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";

/*
 * The roadmap's bands, in a module of their own so a server component can draw them too: the Plan
 * draws them in the app, and the public pages draw the same road as their example plans.
 */

/**
 * A phase's band in its state: the current one raised and ringed in the text color (where the
 * learner is, so a ring without a tint), done ones blue, the rest quiet.
 */
export const BAND_STATE_CLASS: Record<PlanPhaseView["state"], string> = {
  current: "bg-surface-3 text-foreground ring-selected ring-[1.5px] ring-inset",
  done: "bg-success/13 text-success-text",
  leftOut: "bg-muted text-muted-foreground",
  unfinished: "bg-muted text-muted-foreground",
  upcoming: "bg-muted text-muted-foreground",
};

/** A band clips nothing itself, so a band that opens its phase can take a larger hit area. */
export const BAND_CLASS =
  "relative flex h-8 w-full min-w-0 items-center gap-1 rounded-md px-2.5 text-left text-[0.78125rem] font-medium";

/** A day's label under the bands (today, a phase's first day, the goal's date), in the mono face. */
export const AXIS_LABEL_CLASS =
  "text-faint absolute top-0 font-mono text-[0.6875rem] leading-4 whitespace-nowrap tabular-nums";
