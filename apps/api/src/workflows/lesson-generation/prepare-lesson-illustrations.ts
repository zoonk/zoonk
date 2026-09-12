import { logError } from "@zoonk/utils/logger";
import { lessonIllustrationsWorkflow } from "./lesson-illustrations-workflow";
import { type LessonContext } from "./steps/get-lesson-step";
import { startLessonIllustrationsStep } from "./steps/start-lesson-illustrations-step";

/** The first learner receives selected artwork; exhausted image failures recover without blocking saved text. */
export async function prepareLessonIllustrations(input: {
  alts?: string[];
  context: LessonContext;
  prompts: string[];
}): Promise<void> {
  "use workflow";

  if (!input.prompts.some((prompt) => prompt.trim())) {
    return;
  }

  await lessonIllustrationsWorkflow(input).catch(async (error: unknown) => {
    logError("Lesson illustration failed; scheduling independent recovery for saved text", error);
    await startLessonIllustrationsStep(input);
  });
}
