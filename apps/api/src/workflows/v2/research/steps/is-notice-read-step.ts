import { type ExamIdentity } from "@zoonk/core/library/exams/identity";
import { type NoticeReading, findNoticeReading } from "@zoonk/core/library/exams/save";

/**
 * How the exam's blueprint stands with this document (`findNoticeReading`): the PF's 2025 notice,
 * found again while its next one isn't out, isn't read again for minutes, unless its check found
 * what it left out.
 */
export async function findNoticeReadingStep({
  identity,
  sourceId,
}: {
  identity: ExamIdentity;
  sourceId: string;
}): Promise<NoticeReading> {
  "use step";

  return findNoticeReading({ identity, sourceId });
}
