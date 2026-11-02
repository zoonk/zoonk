import {
  SETUP_LESSONS_READY_STEP,
  type SetupLessonStepName,
} from "@zoonk/core/library/generation/steps";
import {
  type SetupLessonWriting,
  getSetupLessonWritingKey,
} from "@zoonk/core/library/tools/setup-lesson-contract";
import { writeSetupLesson } from "@zoonk/core/library/tools/write-setup-lesson";
import { type QuestionWritingResult, runQuestionWriting } from "../goals/question-writing-run";

async function writeSetupLessonStep(input: {
  tool: SetupLessonWriting["tools"][number];
  writing: SetupLessonWriting;
}): Promise<void> {
  "use step";

  await writeSetupLesson(input);
}

export async function setupLessonsWorkflow(
  writing: SetupLessonWriting,
): Promise<QuestionWritingResult> {
  "use workflow";

  return runQuestionWriting<SetupLessonStepName>({
    steps: {
      join: "joinSetupLessons",
      ready: SETUP_LESSONS_READY_STEP,
      write: "writeSetupLessons",
    },
    token: getSetupLessonWritingKey(writing),
    write: async () => {
      await Promise.all(writing.tools.map((tool) => writeSetupLessonStep({ tool, writing })));
      return "written";
    },
  });
}
