import { type LessonContext } from "../steps/get-lesson-step";
import { saveListeningLessonStep } from "../steps/save-listening-lesson-step";

/**
 * Listening lessons mirror the nearest reading lesson's generated sentences
 * with audio-focused steps. Keeping the copy inside the save step makes the
 * source-reading lookup and new step write one retryable operation.
 */
export async function listeningLessonWorkflow(context: LessonContext): Promise<void> {
  "use workflow";

  await saveListeningLessonStep(context);
}
