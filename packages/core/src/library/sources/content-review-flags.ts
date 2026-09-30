import "server-only";
import { type SourceChangeNotice, type TransactionClient } from "@zoonk/db";

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

/**
 * Flags what was built on a source before it changed: lessons with a screen citing it and questions
 * written from it (a law's drills). Rows written after the change already use the new text. A
 * later notice for the same row adds another flag; each flag is resolved when its row is rewritten.
 */
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
      where: { steps: { some: { generatedAt: writtenBefore, sourceId: builtOn } } },
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

/**
 * Stores a change notice together with the review flags of everything built on its source, in the
 * caller's transaction, so a notice never exists without its flags. Source and exam notices both
 * go through here. A corrected exam notice can be a new document (an erratum), so what was built
 * on the document it replaces is flagged too (`replacedSourceId`).
 */
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

/**
 * Marks a rewritten lesson's or question's open flags as done, in the transaction that saved the
 * new version. Flags raised after this version started stay open.
 */
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
