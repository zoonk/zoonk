import { releaseStaleLessonClaims } from "@zoonk/core/library/generation/state";
import { type LessonGenerationRequest } from "@zoonk/core/lookahead/request-lesson-generation";
import { isRunActive } from "../_shared/run-activity";

/** A lesson whose run stopped without ending its claim would otherwise be followed forever. */
export async function requestLiveLessonWriting({
  lessonId,
  request,
}: {
  lessonId: string;
  request: () => Promise<LessonGenerationRequest>;
}): Promise<LessonGenerationRequest> {
  const result = await request();

  if (result.status !== "generating" || (await isRunActive(result.generationId))) {
    return result;
  }

  await releaseStaleLessonClaims({ lessonId, staleRunId: result.generationId });

  return request();
}
