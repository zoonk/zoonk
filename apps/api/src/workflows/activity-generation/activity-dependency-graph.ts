import { type ActivityKind } from "@zoonk/db";

/**
 * Defines which activities must complete before another can start.
 * Only content (steps) is needed from dependencies - visuals/images run in parallel.
 *
 * Dependency graph:
 * background (no deps) → explanation → mechanics
 *                                   → quiz
 */
export const ACTIVITY_DEPENDENCIES: Record<ActivityKind, ActivityKind[]> = {
  background: [],
  challenge: [],
  custom: [],
  examples: [],
  explanation: ["background"],
  grammar: [],
  listening: [],
  mechanics: ["explanation"],
  quiz: ["explanation"],
  reading: [],
  review: [],
  story: [],
  vocabulary: [],
};

/**
 * Gets the token for a hook that workflows wait on.
 * Format: activity:content:{activityKind}:{lessonId}
 */
export function getActivityHookToken(activityKind: ActivityKind, lessonId: number): string {
  return `activity:content:${activityKind}:${lessonId}`;
}
