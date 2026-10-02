import "server-only";
import { isRunActive } from "@/workflows/v2/_shared/run-activity";
import { lessonContentWorkflow } from "@/workflows/v2/lessons/lesson-content-workflow";
import { releaseStaleLessonClaims } from "@zoonk/core/library/generation/state";
import {
  type LessonGenerationRequest,
  requestLessonGeneration,
} from "@zoonk/core/lookahead/request-lesson-generation";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { after } from "next/server";
import { start } from "workflow/api";

/** What asking for a lesson's content did: a run started here is followed like one already writing. */
export type LessonWriting = Exclude<LessonGenerationRequest, { status: "start" }>;

/**
 * A lesson whose run stopped without ending its claim (a crash, a deploy) would be followed
 * forever: its claim is freed and the lesson asked for again, so a fresh run writes it.
 */
async function requestLiveGeneration(lessonId: string) {
  const result = await requestLessonGeneration({ lessonId });

  if (result.status !== "generating" || (await isRunActive(result.generationId))) {
    return result;
  }

  await releaseStaleLessonClaims({ lessonId, staleRunId: result.generationId });

  return requestLessonGeneration({ lessonId });
}

/**
 * Gets a lesson written for the learner or guest in the session, at the priority tier since they
 * reach it within minutes: a written lesson is `ready`, one being written is followed, otherwise
 * a run starts. Asking counts as the lesson start it leads to, so the allowance decides first.
 */
export async function startLessonWriting(lessonId: string): Promise<LessonWriting> {
  const result = await requestLiveGeneration(lessonId);

  if (result.status !== "start") {
    return result;
  }

  const run = await start(lessonContentWorkflow, [
    {
      analytics: result.analytics,
      forExam: result.forExam,
      lessonId: result.lessonId,
      priority: true,
    },
  ]);

  return { generationId: run.runId, status: "generating" };
}

/**
 * Starts writing a lesson the learner reaches next once the response is sent, so the request it
 * rides on isn't slowed down. Opening the lesson asks for it again, with its own wait and retry,
 * so a failure here is only logged.
 */
export function scheduleLessonWriting(lessonId: string): void {
  after(async () => {
    const { error } = await safeAsync(() => startLessonWriting(lessonId));

    if (error) {
      logError(`Could not start writing lesson ${lessonId} ahead.`, error);
    }
  });
}
