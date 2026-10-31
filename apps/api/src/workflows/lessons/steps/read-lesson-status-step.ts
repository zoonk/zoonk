import {
  type LessonGenerationState,
  getLessonGenerationState,
} from "@zoonk/core/library/generation/state";

export async function readLessonStatusStep(
  lessonId: string,
): Promise<LessonGenerationState["status"] | "missing"> {
  "use step";

  const state = await getLessonGenerationState(lessonId);
  return state?.status ?? "missing";
}
