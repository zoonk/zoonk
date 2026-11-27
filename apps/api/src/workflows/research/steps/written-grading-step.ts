import { type BlueprintExtraction } from "@zoonk/ai/tasks/research/extract-exam-blueprint";
import {
  listWrittenGradingInputs,
  readWrittenGrading,
} from "@zoonk/ai/tasks/research/read-written-grading";
import { loadSourceDocuments } from "@zoonk/core/library/sources/load-documents";

/** How the documents say each written task's answers are marked; none without written tasks. */
export async function readWrittenGradingStep({
  extraction,
  sourceIds,
  ...input
}: Omit<Parameters<typeof readWrittenGrading>[0], "documents" | "tasks"> & {
  extraction: BlueprintExtraction;
  sourceIds: string[];
}) {
  "use step";
  const tasks = listWrittenGradingInputs(extraction);

  if (tasks.length === 0) {
    return [];
  }

  const documents = await loadSourceDocuments(sourceIds);
  const found = await readWrittenGrading({ ...input, documents, tasks });

  return found?.data ?? [];
}
