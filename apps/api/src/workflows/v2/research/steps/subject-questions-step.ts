import { findSubjectQuestions } from "@zoonk/ai/tasks/v2/research/find-subject-questions";
import {
  findSubjectQuestionsLookup,
  recordSubjectQuestions,
} from "@zoonk/core/library/exams/record-subject-questions";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ResearchAnalytics } from "../_utils/research-analytics";

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
