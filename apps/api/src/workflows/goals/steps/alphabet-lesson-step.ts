import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import {
  type WriteAlphabetLessonResult,
  writeAlphabetLesson,
} from "@zoonk/core/library/language/write-alphabet-lesson";
import { type ContentAnalytics } from "../../_shared/content-analytics";

export async function prepareAlphabetLessonStep({
  analytics,
  goal,
  workflowRunId,
}: {
  analytics: ContentAnalytics;
  goal: GoalCurriculumInputs["goal"];
  workflowRunId: string;
}): Promise<WriteAlphabetLessonResult | null> {
  "use step";

  if (goal.kind !== "language" || !goal.targetLanguage) {
    return null;
  }

  const targetLanguage = goal.targetLanguage;

  return writeAlphabetLesson({
    analytics,
    learnerLanguage: goal.language,
    targetLanguage,
    workflowRunId,
  });
}
