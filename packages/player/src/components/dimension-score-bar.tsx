"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type DimensionInventory } from "../player-reducer";

const MIN_GAUGE_MAX = 5;

function getBarColor(value: number): string {
  if (value < 0) {return "bg-destructive";}
  if (value === 0) {return "bg-warning";}
  return "bg-foreground/25";
}

function getValueColor(value: number): string {
  if (value < 0) {return "text-destructive font-semibold";}
  if (value === 0) {return "text-warning font-medium";}
  return "text-foreground font-medium";
}

function ScoreGauge({
  changed,
  isNegative,
  maxValue,
  name,
  value,
}: {
  changed: boolean;
  isNegative: boolean;
  maxValue: number;
  name: string;
  value: number;
}) {
  const percentage = Math.max(0, Math.min(100, (value / maxValue) * 100));

  return (
    <div
      className={cn(
        "flex min-w-20 shrink-0 flex-col gap-0.5 sm:min-w-24",
        isNegative && "animate-shake motion-reduce:animate-none",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground truncate text-[11px]">{name}</span>
        <span
          className={cn(
            "text-xs tabular-nums transition-colors duration-300",
            getValueColor(value),
            changed && "animate-score-pulse motion-reduce:animate-none",
          )}
        >
          {value}
        </span>
      </div>

      <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full transition-all duration-500", getBarColor(value))}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function DimensionScoreBar({
  changedDimensions,
  dimensions,
}: {
  changedDimensions: Set<string>;
  dimensions: DimensionInventory;
}) {
  const t = useExtracted();
  const entries = Object.entries(dimensions).toSorted(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) {return null;}

  const values = Object.values(dimensions);
  const maxValue = Math.max(MIN_GAUGE_MAX, ...values);

  return (
    <div
      aria-label={t("Current scores")}
      className={cn(
        "flex gap-3 px-3 pt-2 pb-3 sm:flex-wrap sm:px-4",
        "max-sm:scrollbar-none max-sm:overflow-x-auto",
      )}
      role="status"
    >
      {entries.map(([name, value]) => (
        <ScoreGauge
          changed={changedDimensions.has(name)}
          isNegative={value < 0}
          key={name}
          maxValue={maxValue}
          name={name}
          value={value}
        />
      ))}
    </div>
  );
}
