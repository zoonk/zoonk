import { z } from "zod";

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: where and what before how to fix it. */
export const lessonIssuesSchema = z.object({
  issues: z.array(
    z.object({ screen: z.number().int().nullable(), problem: z.string(), fix: z.string() }),
  ),
});
/* oxlint-enable eslint/sort-keys */

/** `screen` is a 0-based index, or null for the whole lesson. */
export type LessonQualityIssue = z.infer<typeof lessonIssuesSchema>["issues"][number];

/** Screen numbers are 1-based for the model; anything outside the lesson becomes lesson-wide. */
export function toLessonIssue({
  issue,
  screenCount,
}: {
  issue: LessonQualityIssue;
  screenCount: number;
}): LessonQualityIssue {
  const index = issue.screen === null ? null : issue.screen - 1;
  return { ...issue, screen: index !== null && index >= 0 && index < screenCount ? index : null };
}
