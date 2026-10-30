import { trackSystemEvent } from "@zoonk/core/analytics/server";
import { trackLearnerEvents } from "@zoonk/core/analytics/track-learner-event";
import { type ContentAnalytics } from "./content-analytics";

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
