"use client";

import { isDominantPhenotype } from "@zoonk/core/library/activities/combination-grid";
import { cn } from "@zoonk/ui/lib/utils";

/** What each genotype shows, on a Punnett grid; null on a grid of numbers. */
export type GridTraits = { dominant: string; recessive: string } | null;

/** One allele, in the accent color when it's the dominant (uppercase) one. */
function Allele({ value }: { value: string }) {
  return <span className={cn(value !== value.toLowerCase() && "text-viz-accent")}>{value}</span>;
}

/** A cell's value: a genotype with its dominant alleles in the accent color, or a number. */
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

/** The trait a genotype shows: a filled dot for the dominant one, a ring for the recessive. */
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
          isDominant ? "bg-viz-accent" : "ring-muted-foreground ring-1 ring-inset",
        )}
      />
      {isDominant ? traits.dominant : traits.recessive}
    </span>
  );
}

/** A row or column value heading the grid; it lights up while its cell is being filled. */
export function GridHeader({
  isAllele,
  isLit,
  value,
}: {
  isAllele: boolean;
  isLit: boolean;
  value: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "bg-background ring-border flex min-h-11 items-center justify-center rounded-xl text-xl ring-1 motion-safe:transition-colors",
        isLit && "bg-viz-accent-soft ring-viz-accent ring-2",
      )}
    >
      <CellValue isAllele={isAllele} value={value} />
    </div>
  );
}
