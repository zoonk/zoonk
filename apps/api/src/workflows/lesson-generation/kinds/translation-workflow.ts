import { type LessonContext } from "../steps/get-lesson-step";
import { saveTranslationLessonStep } from "../steps/save-translation-lesson-step";

/**
 * Translation lessons are derived from the nearest completed vocabulary lesson,
 * so the source lookup and step copy happen together in the save step.
 */
export async function translationLessonWorkflow(context: LessonContext): Promise<void> {
  "use workflow";

  await saveTranslationLessonStep(context);
}
