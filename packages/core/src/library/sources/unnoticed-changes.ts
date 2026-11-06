import "server-only";
import { type Source, type TransactionClient } from "@zoonk/db";
import { type SourceTopic, hasOwnFreshnessChecks } from "./source-contract";
import { appendTextChange, summarizeTextChange } from "./text-change";

const NOTICE_FAILURES = 3;

export const owesSourceNotice = {
  noticeFailures: { lt: NOTICE_FAILURES },
  unnoticedChangedAt: { not: null },
} as const;

type OwedColumns = Pick<
  Source,
  | "contentHash"
  | "noticeFailures"
  | "unnoticedChangedAt"
  | "unnoticedChanges"
  | "unnoticedFromHash"
  | "unnoticedRevision"
>;

export type OwedSourceChange = {
  change: string;
  changedAt: Date;
  contentHash: string;
  noticeFailures: number;
  previousHash: string;
  revision: number;
};

/**
 * Call in the transaction that saves `text` as the source's new content, and save what it returns
 * with it. A change already owed keeps its earlier lines, so a page that changes back still flags
 * what was written from the version in between, and a new change gets its notice new attempts.
 */
export async function oweSourceChangeNotice({
  sourceId,
  text,
  topic,
  tx,
}: {
  sourceId: string;
  text: string | null;
  topic: SourceTopic;
  tx: TransactionClient;
}): Promise<Partial<OwedColumns>> {
  if (!hasOwnFreshnessChecks(topic)) {
    return {};
  }

  // Saves of one page at once take turns, so each diffs against the text the one before it saved.
  await tx.$queryRaw`SELECT id FROM sources WHERE id = ${sourceId}::uuid FOR NO KEY UPDATE`;

  // Taken once the save holds the row: content written before it read the text this save replaces.
  const changedAt = new Date();

  const stored = await tx.source.findUniqueOrThrow({
    select: {
      contentHash: true,
      extractedText: true,
      unnoticedChanges: true,
      unnoticedFromHash: true,
      unnoticedRevision: true,
    },
    where: { id: sourceId },
  });

  const change = summarizeTextChange({ current: text, previous: stored.extractedText });

  if (!change) {
    return {};
  }

  return {
    noticeFailures: 0,
    unnoticedChangedAt: changedAt,
    unnoticedChanges: stored.unnoticedChanges
      ? appendTextChange({ earlier: stored.unnoticedChanges, later: change })
      : change,
    unnoticedFromHash: stored.unnoticedFromHash ?? stored.contentHash,
    unnoticedRevision: stored.unnoticedRevision + 1,
  };
}

/** Null when nothing is owed, or when the notice failed every time it was tried. */
export function getOwedSourceChange(source: OwedColumns): OwedSourceChange | null {
  const { noticeFailures, unnoticedChangedAt, unnoticedChanges, unnoticedFromHash } = source;

  if (
    !unnoticedChangedAt ||
    !unnoticedChanges ||
    !unnoticedFromHash ||
    noticeFailures >= NOTICE_FAILURES
  ) {
    return null;
  }

  return {
    change: unnoticedChanges,
    changedAt: unnoticedChangedAt,
    contentHash: source.contentHash,
    noticeFailures,
    previousHash: unnoticedFromHash,
    revision: source.unnoticedRevision,
  };
}
