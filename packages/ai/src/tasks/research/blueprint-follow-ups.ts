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
import {
  applyWrittenGrading,
  listWrittenGradingInputs,
  readWrittenGrading,
} from "./read-written-grading";

/**
 * The reads after the blueprint reading, tied to what it found: the question formats, which lead
 * the reading's, then the subjects each written task is on and how its answers are marked. Any of
 * them failing leaves the reading as it is.
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

  const [subjects, grading] = await Promise.all([
    safeAsync(() =>
      findWrittenTaskSubjects({
        ...listTaskSubjectInputs(withFormats),
        analytics,
        documents,
        exam,
        serviceTier,
        useFallback,
      }),
    ),
    safeAsync(() =>
      readWrittenGrading({
        analytics,
        documents,
        exam,
        serviceTier,
        tasks: listWrittenGradingInputs(withFormats),
        useFallback,
      }),
    ),
  ]);

  return applyWrittenGrading({
    extraction: applyWrittenTaskSubjects({
      extraction: withFormats,
      found: subjects.data?.data ?? [],
    }),
    found: grading.data?.data ?? [],
  });
}
