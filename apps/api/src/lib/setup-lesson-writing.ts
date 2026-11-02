import "server-only";
import { setupLessonsWorkflow } from "@/workflows/plans/setup-lessons-workflow";
import { type SetupLessonWriting } from "@zoonk/core/library/tools/setup-lesson-contract";
import { start } from "workflow/api";

export async function startSetupLessonWriting(writing: SetupLessonWriting): Promise<string> {
  const run = await start(setupLessonsWorkflow, [writing]);
  return run.runId;
}
