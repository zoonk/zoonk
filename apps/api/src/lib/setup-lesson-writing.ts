import "server-only";
import { startOnce } from "@/workflows/_shared/run-token";
import { setupLessonsWorkflow } from "@/workflows/plans/setup-lessons-workflow";
import {
  type SetupLessonWriting,
  getSetupLessonWritingKey,
} from "@zoonk/core/library/tools/setup-lesson-contract";

export function startSetupLessonWriting(writing: SetupLessonWriting): Promise<string> {
  return startOnce(setupLessonsWorkflow, [writing], getSetupLessonWritingKey(writing));
}
