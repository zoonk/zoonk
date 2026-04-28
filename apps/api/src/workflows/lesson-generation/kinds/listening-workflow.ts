import { type LessonContext } from "../steps/get-lesson-step";
import { saveListeningLessonStep } from "../steps/save-listening-lesson-step";

export async function listeningLessonWorkflow(context: LessonContext): Promise<void> {
  "use workflow";

  await saveListeningLessonStep(context);
}
