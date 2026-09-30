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

/** When the limit starts over: a daily cap tomorrow, a monthly one next month, a guest's never. */
function readPeriod(value: unknown): "day" | "month" | "total" {
  const period = isJsonObject(value) ? getString(value.limit, "period") : null;
  return period === "month" || period === "total" ? period : "day";
}

/** Maps the start route's outcome (core's own shape) to what the player needs. */
function toStartOutcome(body: unknown): LessonStartOutcome {
  const status = getString(body, "status");

  if (status === "started" && isJsonObject(body)) {
    const run = libraryLessonRunSchema.safeParse(body.run);

    return run.success
      ? { hyperdrive: run.data.hyperdrive, reason: "started", runId: run.data.runId }
      : { reason: "failed" };
  }

  if (status === "slowDown" && isJsonObject(body)) {
    const seconds = body.retryAfterSeconds;
    return { reason: "slowDown", retryAfterSeconds: typeof seconds === "number" ? seconds : 0 };
  }

  if (status === "limitReached") {
    return { period: readPeriod(body), reason: "limitReached", tier: readTier(body) };
  }

  return status === "unauthorized" || status === "notFound"
    ? { reason: status }
    : { reason: "failed" };
}

/**
 * The web player's `startLesson` adapter. It posts to the app's own start route after the player
 * mounts (never while a route is prefetched), and signs a visitor in as a guest first.
 */
export async function startLibraryLesson({
  lessonId,
  studySessionId,
}: {
  lessonId: string;
  studySessionId: string | null;
}): Promise<LessonStartOutcome> {
  if (!(await ensureGuestSession())) {
    return { reason: "unauthorized" };
  }

  const { data: response, error } = await safeAsync(() =>
    fetch(`/api/library/lessons/${encodeURIComponent(lessonId)}/starts`, {
      body: JSON.stringify({
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
