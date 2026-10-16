"use client";

import { getFromBrowser, readJsonForThisLearner } from "@/lib/api/browser-api";
import { getLearnerGeneration } from "@/lib/learner/learner-store";
import { type NextStopLesson } from "@zoonk/learn/session/next-stop";
import { getString } from "@zoonk/utils/json";

/** A lesson's state as its readiness says it, as the next stop's wait draws it. */
const WAITED_LESSON = new Map<string, NextStopLesson>([
  ["failed", "failed"],
  ["generating", "writing"],
  ["notStarted", "notStarted"],
  ["ready", "ready"],
]);

/**
 * Where a waited-for lesson stands, from the API's readiness (the narrow read native clients poll):
 * the wait reads the whole session again only when it changed. Null when it couldn't be read.
 */
export async function readWaitedLesson(
  lessonId: string,
): Promise<{ generationId: string | null; lesson: NextStopLesson } | null> {
  const generation = getLearnerGeneration();

  const response = await getFromBrowser(
    `/v1/library/lessons/${encodeURIComponent(lessonId)}/readiness`,
    () => generation === getLearnerGeneration(),
  );

  if (!response?.ok) {
    return null;
  }

  const body = await readJsonForThisLearner(response);
  const lesson = WAITED_LESSON.get(getString(body, "status") ?? "");

  return generation === getLearnerGeneration() && lesson
    ? { generationId: getString(body, "generationId"), lesson }
    : null;
}
