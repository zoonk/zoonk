"use server";

import { getLearningTargetHref } from "@/data/courses/learning-target-href";
import { parseGenerationReturnTo } from "@/lib/workflow/generation-return-to";
import {
  getCurrentUserCourseDiscovery,
  startCurrentUserCourseDiscovery,
} from "@zoonk/core/courses/discovery";
import { startCurrentUserTrack } from "@zoonk/core/courses/tracks";

/** Continues the explicit Start action once its generated outline becomes available. */
export async function finishGenerationRequest(value: string) {
  const returnTo = parseGenerationReturnTo(value);

  if (!returnTo) {
    return null;
  }

  const id = returnTo.split("/").at(-1);

  if (!id) {
    return null;
  }

  const result = returnTo.startsWith("/tracks/")
    ? await startCurrentUserTrack({ trackId: id })
    : await finishDiscovery(id);

  if (result.status === "needsPlan") {
    return `/b/${result.brandSlug}/c/${result.courseSlug}/start` as const;
  }

  if (result.status === "ready" && result.nextTarget) {
    return getLearningTargetHref(result.nextTarget);
  }

  if (result.status === "generationRequired") {
    const query = `?returnTo=${encodeURIComponent(returnTo)}`;

    return result.resource === "coursePrompt"
      ? (`/generate/course/${result.resourceId}${query}` as const)
      : (`/generate/curriculum/${result.resourceId}${query}` as const);
  }

  return returnTo;
}

async function finishDiscovery(discoveryId: string) {
  const current = await getCurrentUserCourseDiscovery({ discoveryId });

  if (current.status !== "ready") {
    return current;
  }

  return startCurrentUserCourseDiscovery({
    discoveryId,
    expectedRevision: current.discovery.revision,
  });
}
