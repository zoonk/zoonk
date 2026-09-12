import { createHook } from "workflow";
import { generateLessonIllustrationStep } from "./steps/generate-lesson-illustration-step";
import { type LessonContext } from "./steps/get-lesson-step";

/** Illustrations recover independently after a complete readable lesson is available. */
export async function lessonIllustrationsWorkflow({
  alts,
  context,
  prompts,
}: {
  alts?: string[];
  context: LessonContext;
  prompts: string[];
}): Promise<void> {
  "use workflow";

  using claim = createHook({
    token: `lesson-illustrations:${context.id}:${context.chapter.course.contentRevision}`,
  });

  if (await claim.getConflict()) {
    return;
  }

  const results = await Promise.allSettled(
    prompts.map((prompt, stepIndex) =>
      prompt.trim()
        ? generateLessonIllustrationStep({ alt: alts?.[stepIndex], context, prompt, stepIndex })
        : Promise.resolve(),
    ),
  );

  const failed = results.find((result) => result.status === "rejected");

  if (failed?.status === "rejected") {
    throw failed.reason;
  }
}
