import { start } from "workflow/api";
import { lessonIllustrationsWorkflow } from "../lesson-illustrations-workflow";
import { type LessonContext } from "./get-lesson-step";

export async function startLessonIllustrationsStep(input: {
  alts?: string[];
  context: LessonContext;
  prompts: string[];
}): Promise<void> {
  "use step";

  if (!input.prompts.some((prompt) => prompt.trim())) {
    return;
  }

  await start(lessonIllustrationsWorkflow, [input]);
}
