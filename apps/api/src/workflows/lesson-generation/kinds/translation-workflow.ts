import { type LessonContext } from "../steps/get-lesson-step";
import { saveTranslationLessonStep } from "../steps/save-translation-lesson-step";

export async function translationLessonWorkflow(context: LessonContext): Promise<void> {
  "use workflow";

  await saveTranslationLessonStep(context);
}
