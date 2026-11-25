"use client";

import { getFromBrowser } from "@/lib/api/browser-api";
import { type LessonReadiness, type LessonStatus } from "@zoonk/learn/session/types";
import { getString, isJsonObject } from "@zoonk/utils/json";

const STATUSES = new Set<string>([
  "failed",
  "generating",
  "notStarted",
  "ready",
] satisfies LessonStatus[]);

function isLessonStatus(value: string | null): value is LessonStatus {
  return value !== null && STATUSES.has(value);
}

/** The API's live verdict on a lesson's writing. Null when it couldn't tell, as a 503 says. */
export async function readLessonReadiness(lessonId: string): Promise<LessonReadiness | null> {
  const response = await getFromBrowser(
    `/v1/library/lessons/${encodeURIComponent(lessonId)}/readiness`,
  );

  if (!response?.ok) {
    return null;
  }

  const body: unknown = await response.json().catch(() => null);
  const status = getString(body, "status");

  return isLessonStatus(status)
    ? {
        generationId: getString(body, "generationId"),
        setAside: isJsonObject(body) && body.setAside === true,
        status,
      }
    : null;
}
