import {
  type LessonGenerationState,
  getLessonGenerationState,
} from "@zoonk/core/library/generation/state";

/** Where a lesson's content stands right now, or `missing` when the lesson was deleted. */
export async function readLessonStatusStep(
  lessonId: string,
): Promise<LessonGenerationState["status"] | "missing"> {
  "use step";

  const state = await getLessonGenerationState(lessonId);
  return state?.status ?? "missing";
}
