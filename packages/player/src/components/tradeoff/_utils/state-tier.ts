import { type ConsequenceTier } from "./get-consequence-tier";

type StateTier = {
  colorClass: string;
  dotClass: string;
  label: string;
};

/**
 * Maps a cumulative priority state number to a human-readable label
 * and color classes for display.
 *
 * State numbers accumulate across rounds:
 * - Invested (+1 per round), Maintained (0), Neglected (-1)
 * - Events can apply additional state modifiers
 *
 * Returns both `colorClass` (for text) and `dotClass` (for the indicator dot)
 * as literal Tailwind classes — dynamic class construction (e.g., `.replace()`)
 * breaks Tailwind's static analysis.
 *
 * Labels use text + color accent (never color-only) for accessibility.
 */
const THRIVING_THRESHOLD = 3;

export function getStateTier(state: number): StateTier {
  if (state >= THRIVING_THRESHOLD) {
    return { colorClass: "text-success", dotClass: "bg-success", label: "Thriving" };
  }

  if (state === 2) {
    return {
      colorClass: "text-sky-600 dark:text-sky-400",
      dotClass: "bg-sky-600 dark:bg-sky-400",
      label: "Healthy",
    };
  }

  if (state === 1) {
    return {
      colorClass: "text-muted-foreground",
      dotClass: "bg-muted-foreground",
      label: "Stable",
    };
  }

  if (state === 0) {
    return { colorClass: "text-warning", dotClass: "bg-warning", label: "Stressed" };
  }

  return { colorClass: "text-destructive", dotClass: "bg-destructive", label: "Critical" };
}

/**
 * Returns a direction arrow indicating how a priority's state changed
 * in the current round. Used alongside the state label to communicate
 * change visually.
 */
export function getStateDirection(delta: number): string {
  if (delta > 0) {
    return "↑";
  }

  if (delta < 0) {
    return "↓";
  }

  return "→";
}

/**
 * Maps a consequence tier to the state delta it applies.
 *
 * Shared by both the state computation logic (compute-priority-states)
 * and the consequence display (tradeoff-consequences) so the business
 * rule (invested=+1, maintained=0, neglected=-1) lives in one place.
 */
export const CONSEQUENCE_STATE_DELTAS: Record<ConsequenceTier, number> = {
  invested: 1,
  maintained: 0,
  neglected: -1,
};

/**
 * Returns the effective token count for a round, accounting for
 * the optional token override from an event.
 */
export function getEffectiveTokenTotal(content: {
  resource: { total: number };
  tokenOverride: number | null;
}): number {
  return content.tokenOverride ?? content.resource.total;
}
