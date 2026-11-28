import { type ExamIdentity } from "@zoonk/core/library/exams/identity";
import { type NoticeReading, findNoticeReading } from "@zoonk/core/library/exams/notice-reading";

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
