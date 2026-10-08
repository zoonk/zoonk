import { EXAM_BLUEPRINT_PROMPT_VERSION } from "@zoonk/ai/tasks/v2/research/extract-exam-blueprint-version";
import { type ExamIdentity } from "@zoonk/core/library/exams/identity";
import { isNoticeAlreadyRead } from "@zoonk/core/library/exams/save";

/**
 * Whether the exam's blueprint was already read from this notice with the current instructions:
 * the PF's 2025 notice, found again while its next one isn't out, isn't read again for minutes.
 */
export async function isNoticeReadStep({
  identity,
  sourceId,
}: {
  identity: ExamIdentity;
  sourceId: string;
}): Promise<boolean> {
  "use step";

  return isNoticeAlreadyRead({ identity, promptVersion: EXAM_BLUEPRINT_PROMPT_VERSION, sourceId });
}
