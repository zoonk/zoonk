import { defineHook } from "workflow";
import { z } from "zod";

/**
 * Schema for activity content completion notifications.
 * Sent when an activity finishes generating its content (steps).
 * Dependents receive this data to start their own content generation.
 */
const activityContentCompletedSchema = z.object({
  activityId: z.coerce.bigint(),
  activityKind: z.string(),
  lessonId: z.number(),
  steps: z.array(
    z.object({
      text: z.string(),
      title: z.string(),
    }),
  ),
});

/**
 * Type-safe hook for activity content completion.
 * Used to coordinate dependencies between activity workflows.
 *
 * Usage:
 * - Create: `activityContentCompletedHook.create({ token: getActivityHookToken(kind, lessonId) })`
 * - Wait: `const result = await hook`
 * - Resume: `await activityContentCompletedHook.resume(token, payload)`
 */
export const activityContentCompletedHook = defineHook({
  schema: activityContentCompletedSchema,
});
