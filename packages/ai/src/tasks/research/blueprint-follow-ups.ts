import { safeAsync } from "@zoonk/utils/error";
import { listExamParts } from "./exam-parts";
import {
  type BlueprintExtraction,
  type ExtractExamBlueprintParams,
} from "./extract-exam-blueprint";
import { applyQuestionFormats, extractQuestionFormats } from "./extract-question-formats";
import {
  applyWrittenTaskSubjects,
  findWrittenTaskSubjects,
  listTaskSubjectInputs,
} from "./find-written-task-subjects";

/**
 * The reads after the blueprint reading, tied to what it found: the question formats, which lead
 * the reading's, then the subjects each written task is on. Either failing leaves the reading as it is.
 */
export async function readFollowUps({
  extraction,
  params,
}: {
  extraction: BlueprintExtraction;
  params: ExtractExamBlueprintParams;
}): Promise<BlueprintExtraction> {
  const { analytics, documents, exam, serviceTier, useFallback } = params;

  const formats = await safeAsync(() =>
    extractQuestionFormats({
      analytics,
      documents,
      exam,
      model: params.model,
      parts: listExamParts(extraction),
      serviceTier,
      useFallback,
    }),
  );

  const withFormats = applyQuestionFormats({ extraction, found: formats.data?.data ?? [] });

  const subjects = await safeAsync(() =>
    findWrittenTaskSubjects({
      ...listTaskSubjectInputs(withFormats),
      analytics,
      documents,
      exam,
      serviceTier,
      useFallback,
    }),
  );

  return applyWrittenTaskSubjects({ extraction: withFormats, found: subjects.data?.data ?? [] });
}
