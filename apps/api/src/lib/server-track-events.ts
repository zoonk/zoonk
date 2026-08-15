import "server-only";
import { createServerPostHogClient } from "@/lib/server-posthog";
import { track as trackVercelEvent } from "@vercel/analytics/server";
import {
  type GenerationQuotaActor,
  type GenerationQuotaLimit,
} from "@zoonk/core/generation-quotas/contract";
import { safeAsync } from "@zoonk/utils/error";

type AuthCompletionAction = "sign-in" | "sign-up";
type ServerEventProperties = Record<string, boolean | null | number | string>;
export type GenerationRateLimitTarget =
  | { coursePromptId: string; courseSlug?: string | null }
  | { chapterSlug: string; courseSlug: string }
  | { chapterSlug: string; courseSlug: string; lessonSlug: string };

const GENERATION_RATE_LIMITED_EVENT = "Generation Rate Limited";

/**
 * Captures one API server event with a short-lived PostHog client so event
 * helpers only need to choose names and properties instead of repeating SDK
 * lifecycle code.
 */
async function trackServerEvent({
  distinctId,
  event,
  properties,
}: {
  distinctId: string;
  event: string;
  properties?: ServerEventProperties;
}) {
  await safeAsync(async () => {
    const posthog = createServerPostHogClient();

    if (!posthog) {
      return;
    }

    await using client = posthog;

    client.capture({ distinctId, event, properties });
  });
}

/**
 * Captures completed auth outcomes from the server callback because that route
 * already knows whether the returning session still needs first-time setup.
 */
export async function trackAuthCompleted({
  action,
  userId,
}: {
  action: AuthCompletionAction;
  userId: string;
}) {
  await trackServerEvent({
    distinctId: userId,
    event: action === "sign-up" ? "Sign Up Completed" : "Sign In Completed",
  });
}

/**
 * Uses route slugs already loaded by the generation access boundary and falls
 * back to the course-prompt ID before a generated course has a slug.
 */
function getGenerationTargetProperties(target: GenerationRateLimitTarget): ServerEventProperties {
  if ("coursePromptId" in target) {
    return target.courseSlug
      ? { courseSlug: target.courseSlug }
      : { coursePromptId: target.coursePromptId };
  }

  if ("lessonSlug" in target) {
    return {
      chapterSlug: target.chapterSlug,
      courseSlug: target.courseSlug,
      lessonSlug: target.lessonSlug,
    };
  }

  return { chapterSlug: target.chapterSlug, courseSlug: target.courseSlug };
}

/** Records rejected generation work at the API boundary where its existing target metadata is available. */
export async function trackGenerationRateLimited({
  actor,
  limit,
  target,
}: {
  actor: GenerationQuotaActor;
  limit: GenerationQuotaLimit;
  target: GenerationRateLimitTarget;
}) {
  const properties = {
    period: limit.period,
    resource: limit.resource,
    username: actor.username,
    viewer: limit.viewer,
    ...getGenerationTargetProperties(target),
  };

  await Promise.all([
    safeAsync(() => trackVercelEvent(GENERATION_RATE_LIMITED_EVENT, properties)),
    trackServerEvent({
      distinctId: actor.distinctId,
      event: GENERATION_RATE_LIMITED_EVENT,
      properties,
    }),
  ]);
}
