"use client";

import { getFromBrowser } from "@/lib/api/browser-api";
import { type NextStopLesson } from "@zoonk/learn/session/next-stop";
import { getString } from "@zoonk/utils/json";

const WAITED_LESSON = new Map<string, NextStopLesson>([
  ["failed", "failed"],
  ["generating", "writing"],
  ["notStarted", "notStarted"],
  ["ready", "ready"],
]);

/** The wait reads the whole session again only when this changed. Null when it couldn't be read. */
export async function readWaitedLesson(
  lessonId: string,
): Promise<{ generationId: string | null; lesson: NextStopLesson } | null> {
  const response = await getFromBrowser(
    `/v1/library/lessons/${encodeURIComponent(lessonId)}/readiness`,
  );

  if (!response?.ok) {
    return null;
  }

  const body: unknown = await response.json().catch(() => null);
  const lesson = WAITED_LESSON.get(getString(body, "status") ?? "");

  return lesson ? { generationId: getString(body, "generationId"), lesson } : null;
}
