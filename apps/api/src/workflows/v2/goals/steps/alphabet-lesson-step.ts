import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { writeAlphabetLesson } from "@zoonk/core/library/language/write-alphabet-lesson";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics } from "../../_shared/content-analytics";

export async function prepareAlphabetLessonStep({
  analytics,
  goal,
  workflowRunId,
}: {
  analytics: ContentAnalytics;
  goal: GoalCurriculumInputs["goal"];
  workflowRunId: string;
}): Promise<void> {
  "use step";

  if (goal.kind !== "language" || !goal.targetLanguage) {
    return;
  }

  const targetLanguage = goal.targetLanguage;

  await withAiRetry(() =>
    writeAlphabetLesson({
      analytics,
      learnerLanguage: goal.language,
      targetLanguage,
      workflowRunId,
    }),
  );
}
