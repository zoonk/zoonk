import "server-only";
import { type SourceChangeNotice, type TransactionClient } from "@zoonk/db";
import { CURRENT_STEPS } from "../lessons/lesson-versions";

type NoticeData = Pick<
  SourceChangeNotice,
  | "contentHash"
  | "examBlueprintId"
  | "fields"
  | "generatedAt"
  | "language"
  | "message"
  | "model"
  | "previousHash"
  | "promptVersion"
  | "runId"
  | "sourceId"
>;

async function flagContentBuiltOnSource({
  notice,
  sourceIds,
  tx,
}: {
  notice: SourceChangeNotice;
  sourceIds: readonly string[];
  tx: TransactionClient;
}): Promise<number> {
  const writtenBefore = { lt: notice.createdAt };
  const builtOn = { in: [...new Set(sourceIds)] };

  const [lessons, items] = await Promise.all([
    tx.lesson.findMany({
      select: { id: true },
      where: {
        steps: { some: { ...CURRENT_STEPS, generatedAt: writtenBefore, sourceId: builtOn } },
      },
    }),
    tx.item.findMany({
      select: { id: true },
      where: { generatedAt: writtenBefore, sourceId: builtOn },
    }),
  ]);

  const { count } = await tx.contentReviewFlag.createMany({
    data: [
      ...lessons.map((lesson) => ({ lessonId: lesson.id, noticeId: notice.id })),
      ...items.map((item) => ({ itemId: item.id, noticeId: notice.id })),
    ],
    skipDuplicates: true,
  });

  return count;
}

export async function createSourceChangeNotice({
  data,
  replacedSourceId = null,
  tx,
}: {
  data: NoticeData;
  replacedSourceId?: string | null;
  tx: TransactionClient;
}): Promise<SourceChangeNotice> {
  const notice = await tx.sourceChangeNotice.create({ data });
  const sourceIds = [data.sourceId, ...(replacedSourceId ? [replacedSourceId] : [])];

  await flagContentBuiltOnSource({ notice, sourceIds, tx });
  return notice;
}

export async function resolveReviewFlags({
  target,
  tx,
  writtenAt,
}: {
  target: { itemId: string } | { lessonId: string };
  tx: TransactionClient;
  writtenAt: Date;
}): Promise<number> {
  const { count } = await tx.contentReviewFlag.updateMany({
    data: { resolvedAt: writtenAt, status: "rewritten" },
    where: { ...target, createdAt: { lte: writtenAt }, status: "open" },
  });

  return count;
}
