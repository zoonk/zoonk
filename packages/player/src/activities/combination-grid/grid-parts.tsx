"use client";

import { isDominantPhenotype } from "@zoonk/core/library/activities/combination-grid";
import { cn } from "@zoonk/ui/lib/utils";

export type GridTraits = { dominant: string; recessive: string } | null;

function Allele({ value }: { value: string }) {
  return <span className={cn(value !== value.toLowerCase() && "text-viz-accent")}>{value}</span>;
}

export function CellValue({
  className,
  isAllele,
  value,
}: {
  className?: string;
  isAllele: boolean;
  value: string;
}) {
  return (
    <span className={cn("font-semibold tracking-wide tabular-nums", className)}>
      {isAllele ? (
        <>
          <Allele value={value.charAt(0)} />
          <Allele value={value.slice(1)} />
        </>
      ) : (
        value
      )}
    </span>
  );
}

export function Trait({
  className,
  traits,
  value,
}: {
  className?: string;
  traits: GridTraits;
  value: string;
}) {
  if (!traits) {
    return null;
  }

  const isDominant = isDominantPhenotype(value);

  return (
    <span className={cn("text-muted-foreground flex items-center gap-1 text-xs", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "size-2 shrink-0 rounded-full",
          isDominant ? "bg-foreground" : "ring-muted-foreground ring-1 ring-inset",
        )}
      />
      {isDominant ? traits.dominant : traits.recessive}
    </span>
  );
}

export function GridHeader({
  isAllele,
  isCompact,
  isLit,
  value,
}: {
  isAllele: boolean;
  isCompact: boolean;
  isLit: boolean;
  value: string;
}) {
  const numberSize = isCompact ? "text-sm" : "text-lg";

  // A label, not a box: only the asked square is highlighted, and answer tiles never read as table heads.
  return (
    <div
      aria-hidden="true"
      className={cn("flex min-h-11 items-center justify-center", isAllele ? "text-xl" : numberSize)}
    >
      {/* A sum or product grid's cells are the answer, so its headers stay quieter than them. */}
      <CellValue
        className={cn(
          !isAllele && !isLit && "text-muted-foreground",
          isLit && "decoration-viz-accent underline decoration-2 underline-offset-4",
        )}
        isAllele={isAllele}
        value={value}
      />
    </div>
  );
}
