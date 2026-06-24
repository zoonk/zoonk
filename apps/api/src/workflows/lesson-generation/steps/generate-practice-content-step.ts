import { createStepStream } from "@/workflows/_shared/stream-status";
import {
  type LessonPracticeSchema,
  generateLessonPractice,
} from "@zoonk/ai/tasks/lessons/core/practice";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { FatalError } from "workflow";
import { getPreviousExplanationSourceLesson } from "./_utils/explanation-source-steps";
import {
  type PracticeLessonContent,
  type PracticeLessonStep,
} from "./_utils/generated-lesson-content";
import { type LessonContext } from "./get-lesson-step";

/**
 * The generation task uses story language (`scenes.dialogue`) because that
 * produces better structured output. The player stores multiple-choice content
 * as `steps.context`, so the workflow translates the model-facing shape at the
 * boundary before image generation and persistence.
 */
function buildPracticeLessonStep(
  scene: LessonPracticeSchema["scenes"][number],
): PracticeLessonStep {
  return {
    context: scene.dialogue,
    imagePrompt: scene.imagePrompt,
    options: scene.options,
    question: scene.question,
  };
}

/**
 * Generates practice content from the nearest previous explanation metadata.
 * Practice rows are 1:1 companions, so title and description are the complete
 * source scope even before the explanation content itself has generated.
 */
export async function generatePracticeContentStep(
  context: LessonContext,
): Promise<PracticeLessonContent> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generatePracticeContent" });

  const sourceLesson = await getPreviousExplanationSourceLesson(context);

  if (!sourceLesson) {
    throw new FatalError("Practice generation needs explanation lesson metadata");
  }

  const result = await generateLessonPractice({
    chapterTitle: context.chapter.title,
    courseTitle: context.chapter.course.title,
    language: context.language,
    lesson: sourceLesson,
  });

  await stream.status({ status: "completed", step: "generatePracticeContent" });

  return {
    kind: "practice",
    scenario: result.data.scenario,
    steps: result.data.scenes.map(buildPracticeLessonStep),
  };
}
