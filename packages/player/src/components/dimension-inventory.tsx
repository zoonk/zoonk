"use client";

import { type ChallengeEffect } from "@zoonk/core/steps/content-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { IMPACT_DELTA } from "../dimensions";
import { type DimensionInventory as DimensionInventoryType } from "../player-reducer";
import { AnimatedNumber } from "./animated-number";

const STAGGER_INITIAL_DELAY_MS = 400;
const STAGGER_STEP_DELAY_MS = 150;
export const STAGGER_WARNING_EXTRA_MS = 200;

export function getWarningDelay(entryCount: number): number {
  return STAGGER_INITIAL_DELAY_MS + entryCount * STAGGER_STEP_DELAY_MS + STAGGER_WARNING_EXTRA_MS;
}

export type DimensionEntry = {
  delta: number;
  name: string;
  total: number;
};

function formatDelta(delta: number): string {
  return delta >= 0 ? `+${delta}` : `${delta}`;
}

function getSortTier(total: number): number {
  if (total < 0) {
    return 0;
  }
  if (total === 0) {
    return 1;
  }
  return 2;
}

export function buildDimensionEntries(
  dimensions: DimensionInventoryType,
  effects: ChallengeEffect[],
): DimensionEntry[] {
  const deltas: Record<string, number> = {};

  for (const effect of effects) {
    deltas[effect.dimension] = (deltas[effect.dimension] ?? 0) + IMPACT_DELTA[effect.impact];
  }

  return Object.entries(dimensions)
    .map(([name, total]) => ({ delta: deltas[name] ?? 0, name, total }))
    .toSorted((first, second) => {
      const tierDiff = getSortTier(first.total) - getSortTier(second.total);
      if (tierDiff !== 0) {
        return tierDiff;
      }

      // Within negative tier, most negative first
      if (first.total < 0) {
        return first.total - second.total;
      }

      return first.name.localeCompare(second.name);
    });
}

function DimensionInventoryRoot({
  className,
  ...props
}: React.ComponentProps<"ul"> & { "aria-label": string }) {
  return (
    <ul
      className={cn("flex w-full flex-col gap-1", className)}
      data-slot="dimension-inventory"
      {...props}
    />
  );
}

function DeltaPill({ delta, hidden }: { delta: number; hidden?: boolean }) {
  return (
    <span
      aria-hidden={hidden}
      className={cn(
        "min-w-8 rounded-full px-1.5 py-0.5 text-center text-xs font-medium tabular-nums",
        hidden && "opacity-0",
        delta < 0 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success",
      )}
    >
      {formatDelta(delta)}
    </span>
  );
}

type DimensionVariant = "feedback" | "failure" | "intro" | "status" | "success";

function getRowBackground(variant: DimensionVariant, entry: DimensionEntry): string | false {
  if (variant === "feedback" && entry.total < 0) {
    return "bg-destructive/10";
  }

  if (variant === "feedback" && entry.delta < 0 && entry.total === 0) {
    return "bg-warning/5";
  }

  if (variant === "feedback" && entry.delta > 0) {
    return "bg-success/5";
  }

  if (variant === "failure" && entry.total < 0) {
    return "bg-destructive/5";
  }

  return false;
}

function getTotalColor(variant: DimensionVariant, entry: DimensionEntry): string {
  if (variant === "intro") {
    return "text-muted-foreground";
  }

  if (variant === "feedback" && entry.total < 0) {
    return "text-destructive text-base font-bold";
  }

  if (variant === "status") {
    if (entry.total < 0) {
      return "text-destructive";
    }
    if (entry.total === 0) {
      return "text-warning";
    }
    return "text-foreground";
  }

  if (variant === "success") {
    return "text-muted-foreground";
  }

  if (variant === "failure" && entry.total < 0) {
    return "text-destructive font-semibold";
  }

  if (entry.total < 0) {
    return "text-destructive";
  }

  return "text-foreground";
}

function getNameColor(isNegativeFeedback: boolean, isFailureHighlight: boolean): string {
  if (isNegativeFeedback) {
    return "text-destructive font-medium";
  }
  if (isFailureHighlight) {
    return "text-destructive";
  }
  return "text-muted-foreground";
}

function DimensionRow({
  entry,
  staggered,
  staggerIndex,
  variant,
  className,
  ...props
}: Omit<React.ComponentProps<"li">, "style"> & {
  entry: DimensionEntry;
  staggered?: boolean;
  staggerIndex?: number;
  variant: DimensionVariant;
}) {
  const isFailureHighlight = variant === "failure" && entry.total < 0;
  const isNegativeFeedback = variant === "feedback" && entry.total < 0;
  const isFeedback = variant === "feedback";
  const isNegativeDelta = isFeedback && entry.delta < 0;

  return (
    <li
      className={cn(
        "-mx-2 flex items-center justify-between rounded-lg px-2 py-1.5",
        getRowBackground(variant, entry),
        isNegativeFeedback && "border-destructive border-l-2 pl-1.5",
        isFeedback &&
          staggered &&
          "animate-in fade-in slide-in-from-bottom-1 fill-mode-backwards duration-200 motion-reduce:animate-none",
        isNegativeDelta && staggered && "animate-shake motion-reduce:animate-none",
        className,
      )}
      data-slot="dimension-row"
      style={
        staggered
          ? {
              animationDelay: `${STAGGER_INITIAL_DELAY_MS + (staggerIndex ?? 0) * STAGGER_STEP_DELAY_MS}ms`,
            }
          : undefined
      }
      {...props}
    >
      <span className={cn("text-sm", getNameColor(isNegativeFeedback, isFailureHighlight))}>
        {entry.name}
      </span>

      <span className="flex items-center gap-2">
        <span
          className={cn(
            "min-w-6 text-right text-sm font-medium tabular-nums",
            getTotalColor(variant, entry),
          )}
        >
          {isFeedback && staggered ? (
            <AnimatedNumber
              delay={STAGGER_INITIAL_DELAY_MS + (staggerIndex ?? 0) * STAGGER_STEP_DELAY_MS}
              from={entry.total - entry.delta}
              to={entry.total}
            />
          ) : (
            entry.total
          )}
        </span>

        {isFeedback && <DeltaPill delta={entry.delta} hidden={entry.delta === 0} />}
      </span>
    </li>
  );
}

export function DimensionList({
  "aria-label": ariaLabel,
  entries,
  staggered,
  variant,
}: {
  "aria-label": string;
  entries: DimensionEntry[];
  staggered?: boolean;
  variant: DimensionVariant;
}) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <DimensionInventoryRoot
      aria-label={ariaLabel}
      className={cn(
        variant === "feedback" && "animate-in fade-in duration-150 motion-reduce:animate-none",
      )}
    >
      {entries.map((entry, index) => (
        <DimensionRow
          entry={entry}
          key={entry.name}
          staggerIndex={index}
          staggered={staggered}
          variant={variant}
        />
      ))}
    </DimensionInventoryRoot>
  );
}
