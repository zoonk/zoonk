import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { writeAlphabetLesson } from "@zoonk/core/library/language/write-alphabet-lesson";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics } from "../../_shared/content-analytics";

/**
 * A language goal whose script isn't Latin opens its first session with the alphabet: the lesson
 * for the learner's language is written now, once per pair, while placement runs. A rate limit
 * is retried after a minute.
 */
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
