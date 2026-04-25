/**
 * Shared threshold values for story metric feedback.
 *
 * Used by both visual (pill color) and tactile (haptics) feedback
 * to ensure consistent severity bands across the player.
 */
export const METRIC_CRITICAL_THRESHOLD = 15;
export const METRIC_DANGER_THRESHOLD = 25;
export const METRIC_AVERAGE_THRESHOLD = 50;
export const METRIC_GOOD_THRESHOLD = 60;

/**
 * Fixed delta applied to a metric when a story option has a positive,
 * neutral, or negative effect. Used by both the metrics bar (cumulative
 * totals) and the feedback screen (per-option badges).
 */
export const EFFECT_DELTA_MAP = {
  negative: -15,
  neutral: 0,
  positive: 15,
} as const;
