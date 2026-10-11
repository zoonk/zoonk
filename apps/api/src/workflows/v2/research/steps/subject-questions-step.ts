import { findSubjectQuestions } from "@zoonk/ai/tasks/v2/research/find-subject-questions";
import {
  findSubjectQuestionsLookup,
  recordSubjectQuestions,
} from "@zoonk/core/library/exams/record-subject-questions";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ResearchAnalytics } from "../_utils/research-analytics";

/**
 * For a notice that names its subjects without their counts (the OAB's first phase), how many
 * questions each got in the exam's latest edition, looked up once and stored on the blueprint:
 * candidates plan by those counts, and so do the plan's weights. A failure throws, so the runtime
 * retries the step; the counts only add to the notice, so research goes on when the retries run
 * out, and the next learner's research tries again.
 */
export async function lookUpSubjectQuestionsStep({
  analytics,
  examBlueprintId,
}: {
  analytics: ResearchAnalytics;
  examBlueprintId: string;
}): Promise<void> {
  "use step";

  const lookup = await findSubjectQuestionsLookup({ examBlueprintId });

  if (!lookup) {
    return;
  }

  const { data } = await withAiRetry(() =>
    findSubjectQuestions({
      ...lookup,
      analytics,
      today: new Date().toISOString().slice(0, "YYYY-MM-DD".length),
    }),
  );

  await recordSubjectQuestions({
    edition: data.edition,
    examBlueprintId,
    questions: data.questions,
    source: data.source,
    subjects: lookup.subjects,
  });
}
