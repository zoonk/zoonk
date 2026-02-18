"use client";

import { hasNegativeDimension } from "@zoonk/core/player/has-negative-dimension";
import { type ChallengeEffect } from "@zoonk/core/steps/content-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { type DimensionInventory as DimensionInventoryType, effectDelta } from "./player-reducer";

export { hasNegativeDimension };

type DimensionEntry = {
  delta: number;
  name: string;
  total: number;
};

export function formatDelta(delta: number): string {
  return delta >= 0 ? `+${delta}` : `${delta}`;
}

export function getDeltaColor(delta: number): string {
  if (delta < 0) {
    return "text-destructive";
  }

  return "text-success";
}

export function getStatusTotalColor(total: number): string {
  if (total < 0) {
    return "text-destructive";
  }

  if (total === 0) {
    return "text-warning";
  }

  return "text-foreground";
}

export function buildDimensionEntries(
  dimensions: DimensionInventoryType,
  effects: ChallengeEffect[],
): DimensionEntry[] {
  const deltas: Record<string, number> = {};

  for (const effect of effects) {
    deltas[effect.dimension] = (deltas[effect.dimension] ?? 0) + effectDelta(effect.impact);
  }

  return Object.entries(dimensions)
    .map(([name, total]) => ({ delta: deltas[name] ?? 0, name, total }))
    .toSorted(
      (first, second) => second.total - first.total || first.name.localeCompare(second.name),
    );
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
  if (variant === "feedback" && entry.delta > 0) {
    return "bg-success/5";
  }

  if (variant === "feedback" && entry.delta < 0) {
    return "bg-destructive/5";
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

  if (variant === "status") {
    return getStatusTotalColor(entry.total);
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

function DimensionRow({
  entry,
  variant,
  className,
  ...props
}: React.ComponentProps<"li"> & {
  entry: DimensionEntry;
  variant: DimensionVariant;
}) {
  const isFailureHighlight = variant === "failure" && entry.total < 0;

  return (
    <li
      className={cn(
        "-mx-2 flex items-center justify-between rounded-lg px-2 py-1.5",
        getRowBackground(variant, entry),
        className,
      )}
      data-slot="dimension-row"
      {...props}
    >
      <span
        className={cn("text-sm", isFailureHighlight ? "text-destructive" : "text-muted-foreground")}
      >
        {entry.name}
      </span>

      <span className="flex items-center gap-2">
        <span
          className={cn(
            "min-w-6 text-right text-sm font-medium tabular-nums",
            getTotalColor(variant, entry),
          )}
        >
          {entry.total}
        </span>

        {variant === "feedback" && <DeltaPill delta={entry.delta} hidden={entry.delta === 0} />}
      </span>
    </li>
  );
}

export function DimensionList({
  "aria-label": ariaLabel,
  entries,
  variant,
}: {
  "aria-label": string;
  entries: DimensionEntry[];
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
      {entries.map((entry) => (
        <DimensionRow entry={entry} key={entry.name} variant={variant} />
      ))}
    </DimensionInventoryRoot>
  );
}
