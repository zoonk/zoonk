import {
  METRIC_AVERAGE_THRESHOLD,
  METRIC_CRITICAL_THRESHOLD,
  METRIC_DANGER_THRESHOLD,
  METRIC_GOOD_THRESHOLD,
} from "../story";
import { StatusPill, StatusPillLabel, StatusPillValue } from "./status-pill";

/** Returns the Tailwind color class for a metric value based on threshold bands. */
function getMetricColor(value: number): string {
  if (value < METRIC_CRITICAL_THRESHOLD) {
    return "text-destructive font-bold animate-pulse";
  }

  if (value < METRIC_DANGER_THRESHOLD) {
    return "text-destructive font-bold";
  }

  if (value < METRIC_AVERAGE_THRESHOLD) {
    return "text-destructive";
  }

  if (value < METRIC_GOOD_THRESHOLD) {
    return "text-warning";
  }

  return "text-success";
}

/**
 * A compact pill showing a metric label and its color-coded value inline
 * (e.g., "Morale 72").
 *
 * Reused across the story metrics bar and outcome screen to ensure consistent
 * metric presentation. The pill pulses on value change via a CSS animation
 * triggered by a key remount.
 */
export function StoryMetricPill({ metric, value }: { metric: string; value: number }) {
  return (
    <StatusPill animationKey={value}>
      <StatusPillLabel>{metric}</StatusPillLabel>
      <StatusPillValue className={getMetricColor(value)}>{value}</StatusPillValue>
    </StatusPill>
  );
}
