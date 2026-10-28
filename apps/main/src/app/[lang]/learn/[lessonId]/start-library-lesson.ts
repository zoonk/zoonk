import { ensureGuestSession } from "@/lib/guest/ensure-guest-session";
import { libraryLessonRunSchema } from "@zoonk/core/lesson-player/contract";
import { type LessonStartOutcome } from "@zoonk/player/lesson/types";
import { safeAsync } from "@zoonk/utils/error";
import { getString, isJsonObject } from "@zoonk/utils/json";
import { logError } from "@zoonk/utils/logger";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";

function readTier(value: unknown): "free" | "guest" | "plus" {
  const tier = isJsonObject(value) ? getString(value.limit, "tier") : null;
  return tier === "free" || tier === "plus" ? tier : "guest";
}

function readPeriod(value: unknown): "day" | "month" | "total" {
  const period = isJsonObject(value) ? getString(value.limit, "period") : null;
  return period === "month" || period === "total" ? period : "day";
}

function toStartOutcome(body: unknown): LessonStartOutcome {
  const status = getString(body, "status");

  if (status === "started" && isJsonObject(body)) {
    const run = libraryLessonRunSchema.safeParse(body.run);

    return run.success
      ? {
          answers: run.data.answers,
          hyperdrive: run.data.hyperdrive,
          optionalStepIds: run.data.optionalStepIds,
          reason: "started",
          runId: run.data.runId,
          startedAt: run.data.startedAt,
        }
      : { reason: "failed" };
  }

  if (status === "slowDown" && isJsonObject(body)) {
    const seconds = body.retryAfterSeconds;
    return { reason: "slowDown", retryAfterSeconds: typeof seconds === "number" ? seconds : 0 };
  }

  if (status === "limitReached") {
    return { period: readPeriod(body), reason: "limitReached", tier: readTier(body) };
  }

  return status === "unauthorized" || status === "notFound" || status === "plusRequired"
    ? { reason: status }
    : { reason: "failed" };
}

/** Posts to the app's own start route after the player mounts, never while a route is prefetched. */
export async function startLibraryLesson({
  lessonId,
  runId,
  studySessionId,
}: {
  lessonId: string;
  runId?: string;
  studySessionId: string | null;
}): Promise<LessonStartOutcome> {
  // A session check or guest sign-in that failed is worth retrying; it never means "signed out".
  if (!(await ensureGuestSession())) {
    return { reason: "failed" };
  }

  const { data: response, error } = await safeAsync(() =>
    fetch(`/api/library/lessons/${encodeURIComponent(lessonId)}/starts`, {
      body: JSON.stringify({
        ...(runId && { runId }),
        timeZone: getLocalTimeZone(),
        ...(studySessionId && { studySessionId }),
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }),
  );

  if (error || !response.ok) {
    logError("[startLibraryLesson] Failed to start a lesson:", error ?? response.status);
    return { reason: "failed" };
  }

  return toStartOutcome(await response.json().catch(() => null));
}
