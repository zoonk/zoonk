"use client";

import { isDominantPhenotype } from "@zoonk/core/library/activities/punnett-square";
import { cn } from "@zoonk/ui/lib/utils";

/** One allele, in the accent color when it's the dominant (uppercase) one. */
function Allele({ value }: { value: string }) {
  return <span className={cn(value !== value.toLowerCase() && "text-viz-accent")}>{value}</span>;
}

/** A genotype with its dominant alleles in the accent color. */
export function Genotype({ className, value }: { className?: string; value: string }) {
  return (
    <span className={cn("font-bold tracking-wide tabular-nums", className)}>
      <Allele value={value.charAt(0)} />
      <Allele value={value.slice(1)} />
    </span>
  );
}

/** The trait a genotype shows: a filled dot for the dominant one, a ring for the recessive. */
export function Trait({
  className,
  phenotypes,
  value,
}: {
  className?: string;
  phenotypes: { dominant: string; recessive: string };
  value: string;
}) {
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
      {isDominant ? phenotypes.dominant : phenotypes.recessive}
    </span>
  );
}

/** A parent's allele heading a row or column; it lights up while its square is being filled. */
export function AlleleHeader({ allele, isLit }: { allele: string; isLit: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "bg-background ring-border flex min-h-11 items-center justify-center rounded-2xl text-xl ring-1 motion-safe:transition-colors",
        isLit && "bg-viz-accent-soft ring-viz-accent ring-2",
      )}
    >
      <Genotype value={allele} />
    </div>
  );
}
