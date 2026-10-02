import "server-only";
import { scheduleLessonWriting } from "@/lib/lesson-writing";
import { sessionPreparationWorkflow } from "@/workflows/v2/sessions/session-preparation-workflow";
import { getRequestPlatform } from "@zoonk/core/analytics/request-platform";
import { type AnalyticsPlatform } from "@zoonk/core/analytics/shared-properties";
import {
  type SessionPreparationAccess,
  getSessionPreparationAccess,
} from "@zoonk/core/lookahead/session-preparation";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { after } from "next/server";
import { start } from "workflow/api";

type ReadyAccess = Extract<SessionPreparationAccess, { status: "ready" }>;

type SessionPreparationStart =
  | { preparationId: string | null; status: "started" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/** `platform` is the client whose request started the work, which the preparation carries. */
async function startFromAccess({
  access,
  platform,
}: {
  access: ReadyAccess;
  platform: AnalyticsPlatform | null;
}) {
  const preparation = await start(sessionPreparationWorkflow, [
    { goalId: access.goalId, platform, timeZone: access.timeZone, userId: access.userId },
  ]);

  return { preparationId: preparation.runId, status: "started" as const };
}

/**
 * A guest gets only the lesson they reach next written ahead, counted as its start like opening
 * it, so the day's first lesson isn't written only once they reach it; nothing else is prepared.
 */
function writeGuestNextLesson(access: Extract<SessionPreparationAccess, { status: "guest" }>) {
  if (access.lessonId) {
    scheduleLessonWriting(access.lessonId);
  }
}

/**
 * Starts getting a study session's lessons ready: whenever a block starts and when the session
 * ends, the rest of today's lessons and the next study day's get written. A guest gets only the
 * next lesson (`writeGuestNextLesson`).
 */
export async function startSessionPreparation({
  sessionId,
}: {
  sessionId: string;
}): Promise<SessionPreparationStart> {
  const access = await getSessionPreparationAccess({ sessionId });

  if (access.status === "guest") {
    writeGuestNextLesson(access);
    return { preparationId: null, status: "started" };
  }

  if (access.status !== "ready") {
    return access;
  }

  return startFromAccess({ access, platform: await getRequestPlatform() });
}

/**
 * For session routes whose answer shouldn't wait on preparation: access and the client are read
 * from the request, and the run starts after the response is sent. A failure is logged; the next
 * block the learner starts prepares again.
 */
export async function scheduleSessionPreparation(sessionId: string): Promise<void> {
  const [access, platform] = await Promise.all([
    getSessionPreparationAccess({ sessionId }),
    getRequestPlatform(),
  ]);

  if (access.status === "guest") {
    writeGuestNextLesson(access);
    return;
  }

  if (access.status !== "ready") {
    return;
  }

  after(async () => {
    const { error } = await safeAsync(() => startFromAccess({ access, platform }));

    if (error) {
      logError(`Could not start preparing around study session ${sessionId}.`, error);
    }
  });
}
