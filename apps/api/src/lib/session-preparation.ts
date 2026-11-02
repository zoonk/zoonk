import "server-only";
import { sessionPreparationWorkflow } from "@/workflows/sessions/session-preparation-workflow";
import { getRequestPlatform } from "@zoonk/core/analytics/request-platform";
import { askForLessons, endLessonsAsk } from "@zoonk/core/lookahead/lessons-ask";
import {
  getGoalPreparationAccess,
  getSessionPreparationAccess,
} from "@zoonk/core/lookahead/session-preparation";
import { safeAsync } from "@zoonk/utils/error";
import { start } from "workflow/api";

type SessionPreparationStart =
  | { preparationId: string | null; status: "started" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/** The contract names no run for a guest's ask: theirs writes only their next lesson, not their sessions'. */
function toStarted({ guest, runId }: { guest: boolean; runId: string }): SessionPreparationStart {
  return { preparationId: guest ? null : runId, status: "started" };
}

/** A learner's explicit ask; their writes already owe their session's preparation as follow-ups. */
export async function startSessionPreparation({
  sessionId,
}: {
  sessionId: string;
}): Promise<SessionPreparationStart> {
  const [access, platform] = await Promise.all([
    getSessionPreparationAccess({ sessionId }),
    getRequestPlatform(),
  ]);

  if (access.status === "notFound" || access.status === "unauthorized") {
    return access;
  }

  if (access.status === "plusRequired") {
    return { preparationId: null, status: "started" };
  }

  const run = await start(sessionPreparationWorkflow, [
    { platform, sessionId, userId: access.userId },
  ]);

  return toStarted({ guest: access.status === "guest", runId: run.runId });
}

/** "Prepare lessons": the day reads as getting them from the ask on, until the preparation ends it. */
export async function startGoalPreparation({
  goalId,
}: {
  goalId: string;
}): Promise<SessionPreparationStart> {
  const [access, platform] = await Promise.all([
    getGoalPreparationAccess({ goalId }),
    getRequestPlatform(),
  ]);

  if (access.status === "notFound" || access.status === "unauthorized") {
    return access;
  }

  if (access.status === "plusRequired") {
    return { preparationId: null, status: "started" };
  }

  const lessonsAskedAt = await askForLessons({ goalId });

  // A preparation that never starts can't end the ask, so the request does.
  const { data: run, error } = await safeAsync(() =>
    start(sessionPreparationWorkflow, [
      { goalId, lessonsAskedAt, platform, userId: access.userId },
    ]),
  );

  if (error) {
    if (lessonsAskedAt) {
      await endLessonsAsk({ askedAt: lessonsAskedAt, goalId, startedCourseIds: [] });
    }

    throw error;
  }

  return toStarted({ guest: access.status === "guest", runId: run.runId });
}
