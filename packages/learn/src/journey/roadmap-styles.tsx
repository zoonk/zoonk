import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { cn } from "@zoonk/ui/lib/utils";
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

export const AXIS_CLASS = "@container/phase relative flex min-h-4 flex-wrap gap-x-2";

export const AXIS_TEXT_CLASS =
  "text-faint max-w-[100cqw] shrink-0 font-mono text-[0.6875rem] leading-4 text-balance whitespace-normal tabular-nums";

const MIDDLE_SHARE = 0.5;

const PERCENT = 100;

export function getPointSide(share: number): "left" | "right" {
  return share < MIDDLE_SHARE ? "left" : "right";
}

function getAxisLabelBox({ after, share }: { after: boolean; share: number }): {
  className: string;
  style: CSSProperties;
} {
  if (after) {
    return {
      className: "ml-auto flex max-w-full text-right",
      style: { paddingRight: `${(1 - share) * PERCENT}%` },
    };
  }

  if (getPointSide(share) === "left") {
    return {
      className: "flex max-w-full justify-end",
      style: { paddingLeft: `${share * PERCENT}%` },
    };
  }

  return {
    className: "flex max-w-full min-w-fit justify-end text-right",
    style: { width: `${share * PERCENT}%` },
  };
}

/**
 * Every label under a phase stays inside it: it sits at its point, slides back when there's no
 * room past it, takes the next line when it meets the label before it, and breaks between words
 * when it's wider than the phase. The phase's first label is placed from the phase's start and one
 * `after` it, always in the second half, from the phase's end, so the first can't push it off its
 * point. Its child carries `AXIS_TEXT_CLASS`.
 */
export function AxisLabel({
  after = false,
  children,
  className,
  share,
}: {
  after?: boolean;
  children: React.ReactNode;
  className?: string;
  share: number;
}) {
  const box = getAxisLabelBox({ after, share });

  return (
    <span className={cn(box.className, className)} style={box.style}>
      {children}
    </span>
  );
}
