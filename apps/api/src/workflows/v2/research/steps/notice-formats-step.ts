import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { extractQuestionFormats } from "@zoonk/ai/tasks/v2/research/extract-question-formats";
import { recordGoalNoticeFormats } from "@zoonk/core/library/exams/notice-formats";
import { loadSourceDocuments } from "@zoonk/core/library/sources/load-documents";
import { safeAsync } from "@zoonk/utils/error";
import { type ResearchAnalytics } from "../_utils/research-analytics";

/**
 * A first pass over a new exam's notice, beside its reading: only its question formats, read in
 * seconds while the whole notice takes minutes, kept on the goal so placement's first questions
 * follow the exam (Cebraspe's statements judged right or wrong, FGV's four options) instead of
 * waiting minutes for the notice or asking in another format. A pass that fails leaves placement
 * to the reading.
 */
export async function recordNoticeFormatsStep({
  analytics,
  exam,
  goalId,
  sourceIds,
}: {
  analytics: ResearchAnalytics;
  /** The exam's name and role, as the reading names it. */
  exam: string;
  goalId: string;
  sourceIds: string[];
}): Promise<void> {
  "use step";

  const documents = await loadSourceDocuments(sourceIds);

  // The notice serves every learner of the exam, and the learner waits for placement on it.
  const serviceTier = chooseServiceTier({ reuse: "bounded", wait: "learner" });

  const { data } = await safeAsync(() =>
    extractQuestionFormats({ analytics, documents, exam, serviceTier }),
  );

  if (!data) {
    return;
  }

  await recordGoalNoticeFormats({
    documents: documents.map((document) => ({ sourceId: document.id, text: document.text })),
    formats: data.data,
    goalId,
  });
}
