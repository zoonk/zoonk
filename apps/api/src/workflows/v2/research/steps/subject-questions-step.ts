import { findSubjectQuestions } from "@zoonk/ai/tasks/v2/research/find-subject-questions";
import {
  findSubjectQuestionsLookup,
  recordSubjectQuestions,
} from "@zoonk/core/library/exams/record-subject-questions";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ResearchAnalytics } from "../_utils/research-analytics";

/**
 * For a notice that names its subjects without their counts (the OAB's 1ª fase), how many
 * questions each got in the exam's latest edition, looked up once and stored on the blueprint:
 * candidates plan by those counts, and so do the plan's weights. The counts only add to the
 * notice, so a lookup that fails is logged and tried again by the next learner's research.
 */
export async function lookUpSubjectQuestionsStep({
  analytics,
  examBlueprintId,
}: {
  analytics: ResearchAnalytics;
  examBlueprintId: string;
}): Promise<void> {
  "use step";

  const { error } = await safeAsync(async () => {
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
  });

  if (error) {
    logError(
      `The subject counts of exam blueprint ${examBlueprintId} couldn't be looked up:`,
      error,
    );
  }
}
