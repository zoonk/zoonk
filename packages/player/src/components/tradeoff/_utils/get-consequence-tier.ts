export type ConsequenceTier = "invested" | "maintained" | "neglected";

const INVESTED_THRESHOLD = 2;

/**
 * Maps a token allocation to a consequence tier.
 *
 * The three-tier system prevents "spread evenly" as a dominant strategy:
 * - 0 tokens = neglected (priority declines)
 * - 1 token = maintained (treading water, no improvement)
 * - 2+ tokens = invested (real improvement)
 *
 * With this system, distributing 1 token to everything keeps things
 * stable but improves nothing. You must concentrate to make progress,
 * which forces genuine tradeoff decisions.
 */
export function getConsequenceTier(tokens: number): ConsequenceTier {
  if (tokens >= INVESTED_THRESHOLD) {
    return "invested";
  }

  if (tokens >= 1) {
    return "maintained";
  }

  return "neglected";
}
