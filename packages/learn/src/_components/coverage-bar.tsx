"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

const PERCENT = 100;

function clampShare(share: number, room = 1): number {
  return Math.min(room, Math.max(0, share));
}

/** Shares are 0 to 1. */
export function CoverageBar({
  className,
  known = 0,
  studied,
}: {
  className?: string;
  known?: number;
  studied: number;
}) {
  const studiedShare = clampShare(studied);
  const knownShare = clampShare(known, 1 - studiedShare);

  return (
    <span
      aria-hidden="true"
      className={cn("bg-surface-3 flex h-1.5 w-full overflow-hidden rounded-[3px]", className)}
      data-slot="coverage-bar"
    >
      <span className="bg-success h-full" style={{ width: `${studiedShare * PERCENT}%` }} />
      <span
        className="bg-muted-foreground/70 h-full"
        style={{ width: `${knownShare * PERCENT}%` }}
      />
    </span>
  );
}

type CoverageState = "known" | "new" | "studied" | "today";

const DEFAULT_STATES: readonly CoverageState[] = ["studied", "known", "new"];

function LegendItem({ state }: { state: CoverageState }) {
  const t = useExtracted();

  const marks: Record<CoverageState, { className: string; label: string }> = {
    known: { className: "bg-muted-foreground/70", label: t("Known") },
    new: { className: "ring-muted-foreground/70 ring-1 ring-inset", label: t("New") },
    studied: { className: "bg-success", label: t("Studied") },
    today: { className: "ring-success ring-1 ring-inset", label: t("Today") },
  };

  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-1.5 rounded-full", marks[state].className)} />
      {marks[state].label}
    </span>
  );
}

export function CoverageLegend({
  className,
  states = DEFAULT_STATES,
}: {
  className?: string;
  states?: readonly CoverageState[];
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("text-muted-foreground flex items-center gap-3 text-[0.71875rem]", className)}
      data-slot="coverage-legend"
    >
      {states.map((state) => (
        <LegendItem key={state} state={state} />
      ))}
    </span>
  );
}
