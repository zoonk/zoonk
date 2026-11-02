"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { usePhaseEndRows } from "./use-phase-ends-text";

export function PhaseEndMoves({
  className,
  effect,
}: {
  className?: string;
  effect: PlanChangeView["effect"];
}) {
  const rows = usePhaseEndRows()(effect);

  if (rows.length === 0) {
    return null;
  }

  return (
    <ul className={cn("text-muted-foreground flex flex-col gap-0.5 text-sm", className)}>
      {rows.map((row) => (
        <li key={row}>{row}</li>
      ))}
    </ul>
  );
}
