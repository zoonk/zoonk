import { listExamParts } from "@zoonk/ai/tasks/research/exam-parts";
import { type BlueprintExtraction } from "@zoonk/ai/tasks/research/extract-exam-blueprint";
import {
  applyQuestionFormats,
  extractQuestionFormats,
} from "@zoonk/ai/tasks/research/extract-question-formats";
import { loadSourceDocuments } from "@zoonk/core/library/sources/load-documents";

/** Reads the question formats on their own, tied to the parts the reading found. */
export async function readBlueprintFormatsStep({
  extraction,
  sourceIds,
  ...input
}: Omit<Parameters<typeof extractQuestionFormats>[0], "documents" | "parts"> & {
  sourceIds: string[];
  extraction: BlueprintExtraction;
}) {
  "use step";
  const documents = await loadSourceDocuments(sourceIds);

  const { data } = await extractQuestionFormats({
    ...input,
    documents,
    parts: listExamParts(extraction),
  });

  return applyQuestionFormats({ extraction, found: data });
}
