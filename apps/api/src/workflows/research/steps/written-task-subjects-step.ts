import { type BlueprintExtraction } from "@zoonk/ai/tasks/research/extract-exam-blueprint";
import {
  applyWrittenTaskSubjects,
  findWrittenTaskSubjects,
  listTaskSubjectInputs,
} from "@zoonk/ai/tasks/research/find-written-task-subjects";
import { loadSourceDocuments } from "@zoonk/core/library/sources/load-documents";

/** Ties each written task to the subjects the notice says its questions are on; none without written tasks. */
export async function readWrittenTaskSubjectsStep({
  extraction,
  sourceIds,
  ...input
}: Omit<Parameters<typeof findWrittenTaskSubjects>[0], "documents" | "names" | "tasks"> & {
  extraction: BlueprintExtraction;
  sourceIds: string[];
}) {
  "use step";
  const asked = listTaskSubjectInputs(extraction);

  if (asked.tasks.length === 0 || asked.names.length === 0) {
    return extraction;
  }

  const documents = await loadSourceDocuments(sourceIds);
  const found = await findWrittenTaskSubjects({ ...input, ...asked, documents });

  return applyWrittenTaskSubjects({ extraction, found: found?.data ?? [] });
}
