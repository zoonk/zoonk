import "server-only";
import { type SourceChangeNotice, type TransactionClient } from "@zoonk/db";
import { CURRENT_STEPS } from "../lessons/lesson-versions";

/** The `contentHash` of a source as a writer read it, captured in the query that read its text. */
export type SourceVersion = { contentHash: string; sourceId: string };

/** A null `contentHash` is content written without recording what it read: any change flags it. */
export type SourceRead = { contentHash: string | null; sourceId: string };

type ReviewTarget = { itemId: string } | { lessonId: string };

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
 * A notice locks its sources before it looks for what to flag, and a write locks the sources it
 * read before it checks them, so each sees the other's rows whichever commits first.
 */
async function lockSourcesForNotice(tx: TransactionClient, sourceIds: readonly string[]) {
  await tx.$queryRaw`
    SELECT id FROM sources WHERE id = ANY(${[...sourceIds]}::uuid[])
    ORDER BY id FOR NO KEY UPDATE
  `;
}

/** Sources deleted since they were read, such as an upload merged into its public copy, are left out. */
async function lockReadSources(
  tx: TransactionClient,
  sourceIds: readonly string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(sourceIds)];

  if (ids.length === 0) {
    return new Map();
  }

  const sources = await tx.$queryRaw<{ content_hash: string; id: string }[]>`
    SELECT id, content_hash FROM sources WHERE id = ANY(${ids}::uuid[])
    ORDER BY id FOR SHARE
  `;

  return new Map(sources.map((source) => [source.id, source.content_hash]));
}

export async function saveStepSources(
  tx: TransactionClient,
  steps: readonly { id: string; sources?: readonly SourceRead[] }[],
): Promise<void> {
  const read = await lockReadSources(
    tx,
    steps.flatMap((step) => (step.sources ?? []).map((source) => source.sourceId)),
  );

  await tx.stepSource.createMany({
    data: steps.flatMap((step) =>
      (step.sources ?? [])
        .filter((source) => read.has(source.sourceId))
        .map((source) => ({ ...source, stepId: step.id })),
    ),
  });
}

export function toSourceVersions(
  pages: readonly { sourceHash: string; sourceId: string }[],
): SourceVersion[] {
  const versions = new Map(pages.map((page) => [page.sourceId, page.sourceHash]));
  return [...versions].map(([sourceId, contentHash]) => ({ contentHash, sourceId }));
}

async function flagContentBuiltOnSource({
  notice,
  sourceIds,
  tx,
}: {
  notice: SourceChangeNotice;
  sourceIds: readonly string[];
  tx: TransactionClient;
}): Promise<number> {
  const builtOn = { in: [...new Set(sourceIds)] };
  const otherVersion = { not: notice.contentHash };
  const readLessons = { distinct: ["lessonId" as const], select: { lessonId: true } };

  const [read, cited, items] = await Promise.all([
    tx.step.findMany({
      ...readLessons,
      where: {
        ...CURRENT_STEPS,
        sources: {
          some: { OR: [{ contentHash: otherVersion }, { contentHash: null }], sourceId: builtOn },
        },
      },
    }),
    tx.step.findMany({
      ...readLessons,
      where: { ...CURRENT_STEPS, sourceId: builtOn, sources: { none: {} } },
    }),
    tx.item.findMany({
      select: { id: true },
      where: { OR: [{ sourceHash: otherVersion }, { sourceHash: null }], sourceId: builtOn },
    }),
  ]);

  const lessonIds = new Set([...read, ...cited].map((step) => step.lessonId));

  const { count } = await tx.contentReviewFlag.createMany({
    data: [
      ...[...lessonIds].map((lessonId) => ({ lessonId, noticeId: notice.id })),
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
  const sourceIds = [data.sourceId, ...(replacedSourceId ? [replacedSourceId] : [])];

  await lockSourcesForNotice(tx, sourceIds);

  const notice = await tx.sourceChangeNotice.create({ data });

  await flagContentBuiltOnSource({ notice, sourceIds, tx });
  return notice;
}

function listStaleSources({
  current,
  reads,
}: {
  current: ReadonlyMap<string, string>;
  reads: readonly SourceRead[];
}): string[] {
  return [
    ...new Set(
      reads
        .filter(({ contentHash, sourceId }) => {
          const now = current.get(sourceId);
          return now !== undefined && contentHash !== now;
        })
        .map(({ sourceId }) => sourceId),
    ),
  ];
}

/**
 * Content saved from a source's older text is flagged with the notice of the current text, or by
 * that notice when it's still owed. A flag resolves only once the content reads no older text of
 * the notice's source, so a rewrite whose source changed during its call stays flagged.
 */
async function reconcileReviewFlags({
  reads,
  targets,
  tx,
}: {
  reads: readonly SourceRead[];
  targets: readonly ReviewTarget[];
  tx: TransactionClient;
}): Promise<void> {
  if (targets.length === 0) {
    return;
  }

  const current = await lockReadSources(
    tx,
    reads.map((read) => read.sourceId),
  );

  const stale = listStaleSources({ current, reads });

  const latest = await Promise.all(
    stale.map((sourceId) =>
      tx.sourceChangeNotice.findFirst({
        orderBy: { createdAt: "desc" },
        select: { contentHash: true, id: true, sourceId: true },
        where: { sourceId },
      }),
    ),
  );

  const noticed = latest.filter(
    (notice) => notice && notice.contentHash === current.get(notice.sourceId),
  );

  await tx.contentReviewFlag.createMany({
    data: noticed.flatMap((notice) =>
      notice ? targets.map((target) => ({ ...target, noticeId: notice.id })) : [],
    ),
    skipDuplicates: true,
  });

  await tx.contentReviewFlag.updateMany({
    data: { resolvedAt: new Date(), status: "rewritten" },
    where: { OR: [...targets], notice: { sourceId: { notIn: stale } }, status: "open" },
  });
}

/** Call in the transaction that changes which steps are the lesson's current ones. */
export async function reconcileLessonReviewFlags(
  tx: TransactionClient,
  lessonId: string,
): Promise<void> {
  const steps = await tx.step.findMany({
    select: { sourceId: true, sources: { select: { contentHash: true, sourceId: true } } },
    where: { lessonId, ...CURRENT_STEPS },
  });

  const reads = steps.flatMap((step): SourceRead[] => {
    if (step.sources.length > 0) {
      return step.sources;
    }

    return step.sourceId ? [{ contentHash: null, sourceId: step.sourceId }] : [];
  });

  await reconcileReviewFlags({ reads, targets: [{ lessonId }], tx });
}

/** Call in the transaction that saves the items' content, all written from `source`. */
export async function reconcileItemReviewFlags(
  tx: TransactionClient,
  { itemIds, source }: { itemIds: readonly string[]; source: SourceVersion },
): Promise<void> {
  await reconcileReviewFlags({
    reads: [source],
    targets: itemIds.map((itemId) => ({ itemId })),
    tx,
  });
}
