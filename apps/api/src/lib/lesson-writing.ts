import "server-only";
import { lessonContentWorkflow } from "@/workflows/lessons/lesson-content-workflow";
import { requestLiveLessonWriting } from "@/workflows/lessons/lesson-writing-request";
import {
  type LessonGenerationRequest,
  requestLessonGeneration,
} from "@zoonk/core/lookahead/request-lesson-generation";
import { start } from "workflow/api";

export type LessonWriting = Exclude<LessonGenerationRequest, { status: "start" }>;

/** Asking counts as the lesson start it leads to, so the allowance decides first. */
export async function startLessonWriting(lessonId: string): Promise<LessonWriting> {
  const result = await requestLiveLessonWriting({
    lessonId,
    request: () => requestLessonGeneration({ lessonId }),
  });

  if (result.status !== "start") {
    return result;
  }

  const run = await start(lessonContentWorkflow, [
    {
      analytics: result.analytics,
      forExam: result.forExam,
      lessonId: result.lessonId,
      wait: "learner",
    },
  ]);

  return { generationId: run.runId, status: "generating" };
}
