import { extractPastQuestions } from "@zoonk/ai/tasks/v2/items/past-questions";
import {
  type PastPaperTarget,
  listPastQuestionPapers,
  loadPastPaperText,
  savePastQuestions,
} from "@zoonk/core/library/items/past-questions";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";

/** A first set per paper: enough real questions for weeks of practice. */
const QUESTIONS_PER_PAPER = 20;

export async function listPastQuestionPapersStep(goalId: string): Promise<PastPaperTarget[]> {
  "use step";

  return listPastQuestionPapers({ goalId });
}

/**
 * Copies real questions from one past paper whose organizer allows it (Enem, Brazilian boards),
 * each on the skill it tests and citing the paper. The paper's text is read inside the step, so
 * it never goes into the run's history, and code checks every quoted part against it.
 */
export async function importPastQuestionsStep({
  analytics,
  target,
  workflowRunId,
}: {
  analytics?: ContentAnalytics;
  target: PastPaperTarget;
  workflowRunId: string;
}): Promise<number> {
  "use step";

  const paperText = await loadPastPaperText(target.paper.id);

  if (!paperText) {
    return 0;
  }

  const { data, provenance } = await withAiRetry(() =>
    extractPastQuestions({
      analytics: toContentAnalytics({ analytics, scope: { ownerId: null }, workflowRunId }),
      count: QUESTIONS_PER_PAPER,
      exam: target.exam,
      format: target.format,
      language: target.language,
      optionCount: target.optionCount,
      paper: { text: paperText, title: target.paper.title },
      skills: target.skills.map(({ description, name }) => ({ description, name })),
    }),
  );

  const { created } = await savePastQuestions({
    paperText,
    provenance,
    questions: data.questions,
    target,
  });

  return created;
}
