import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { extractQuestionFormats } from "@zoonk/ai/tasks/v2/research/extract-question-formats";
import { recordGoalNoticeFormats } from "@zoonk/core/library/exams/notice-formats";
import { loadSourceDocuments } from "@zoonk/core/library/sources/load-documents";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { type ResearchAnalytics } from "../_utils/research-analytics";

/**
 * Reads only the question formats, in seconds, so placement's first questions follow the exam
 * instead of waiting minutes for the whole notice.
 */
export async function recordNoticeFormatsStep({
  analytics,
  exam,
  goalId,
  sourceIds,
}: {
  analytics: ResearchAnalytics;
  exam: string;
  goalId: string;
  sourceIds: string[];
}): Promise<void> {
  "use step";

  const documents = await loadSourceDocuments(sourceIds);

  const serviceTier = chooseServiceTier({ reuse: "bounded", wait: "learner" });

  // Not retried: the reading beside it reads the formats too, and retries would only hold
  // research's end.
  const { data, error } = await safeAsync(() =>
    extractQuestionFormats({ analytics, documents, exam, serviceTier }),
  );

  if (error) {
    logError(
      `The first pass over the notice of "${exam}" failed; its reading has the formats:`,
      error,
    );

    return;
  }

  await recordGoalNoticeFormats({
    documents: documents.map((document) => ({ sourceId: document.id, text: document.text })),
    formats: data.data,
    goalId,
  });
}
