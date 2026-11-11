import "server-only";
import { type Source, type TransactionClient } from "@zoonk/db";
import { isCutText } from "./parse-document";
import { SOURCE_READ_VERSION, type SourceTopic, hasOwnFreshnessChecks } from "./source-contract";
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

/** A line's letters and digits, which no change in how a page's accents were decoded moves. */
function toLineKey(line: string): string {
  return line.toLowerCase().replaceAll(/[^a-z0-9]/gu, "");
}

/**
 * True when `current` says nothing `previous` didn't: it dropped lines (struck-through wording),
 * decoded accents differently, or went on past where an older reader cut the text.
 */
function isOnlyRereading({ current, previous }: { current: string; previous: string }): boolean {
  const known = new Set(previous.split("\n").map((line) => toLineKey(line)));

  const lines = current
    .split("\n")
    .map((line) => toLineKey(line))
    .filter(Boolean);

  const lastKnown = lines.findLastIndex((line) => known.has(line));
  const compared = isCutText(previous) ? lines.slice(0, lastKnown + 1) : lines;

  return compared.every((line) => known.has(line));
}

export type OwedSourceChange = {
  change: string;
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
      readVersion: true,
      unnoticedChanges: true,
      unnoticedFromHash: true,
      unnoticedRevision: true,
    },
    where: { id: sourceId },
  });

  const change = summarizeTextChange({ current: text, previous: stored.extractedText });

  const isRereading =
    stored.readVersion < SOURCE_READ_VERSION &&
    isOnlyRereading({ current: text ?? "", previous: stored.extractedText ?? "" });

  if (!change || isRereading) {
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
    contentHash: source.contentHash,
    noticeFailures,
    previousHash: unnoticedFromHash,
    revision: source.unnoticedRevision,
  };
}
