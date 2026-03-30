"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { getStateDirection, getStateTier } from "./_utils/state-tier";
import { useStateTierLabel } from "./use-state-tier-label";

/**
 * Displays a priority's state as a text label with a subtle colored dot.
 * Never uses color alone to communicate state — the text label is always
 * present for accessibility.
 *
 * Optionally shows a direction arrow (↑/→/↓) when the state changed.
 */
export function TradeoffStateLabel({
  className,
  delta,
  state,
}: {
  className?: string;
  delta?: number;
  state: number;
}) {
  const translateLabel = useStateTierLabel();
  const tier = getStateTier(state);
  const direction = delta === undefined ? null : getStateDirection(delta);

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <span aria-hidden className={cn("size-2 rounded-full", tier.dotClass)} />
      <span className={tier.colorClass}>
        {translateLabel(tier.label)}
        {direction && ` ${direction}`}
      </span>
    </span>
  );
}
