import { trackSystemEvent } from "@zoonk/core/analytics/server";
import { trackLearnerEvents } from "@zoonk/core/analytics/track-learner-event";
import { type ContentAnalytics } from "./content-analytics";

/**
 * "Generation Failed" for a run that gave up on content: counted for the learner whose request
 * started it, with their goal and client, or under the system's id for runs no learner started
 * (sweeps and the background work they start), which never create a person in PostHog. `task`
 * names the run.
 */
export async function trackGenerationFailedStep({
  analytics,
  contentKind,
  task,
}: {
  analytics?: ContentAnalytics;
  contentKind: "course" | "curriculum" | "explanation" | "lesson";
  task: string;
}): Promise<void> {
  "use step";

  const event = {
    name: "Generation Failed",
    properties: { content_kind: contentKind, model: null, task },
  } as const;

  if (!analytics?.distinctId) {
    await trackSystemEvent(event);
    return;
  }

  await trackLearnerEvents({
    events: [event],
    goalId: analytics.goalId,
    platform: analytics.platform ?? null,
    userId: analytics.distinctId,
  });
}
