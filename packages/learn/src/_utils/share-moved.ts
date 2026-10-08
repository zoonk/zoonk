const PERCENT = 100;

/**
 * Whether a share moved in the whole percentages screens show: 0.321 to 0.324 reads "32% → 32%",
 * which says nothing, so it doesn't count as a change.
 */
export function hasShareMoved({ after, before }: { after: number; before: number }): boolean {
  return Math.round(before * PERCENT) !== Math.round(after * PERCENT);
}
