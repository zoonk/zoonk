import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { type SourceTopic, hasOwnFreshnessChecks } from "./source-contract";
import { appendTextChange, summarizeTextChange } from "./text-change";

export type OwedSourceChange = {
  change: string;
  changedAt: Date;
  contentHash: string;
  previousHash: string;
};

/**
 * Call in the transaction that moves the source's `contentHash`, before `text` is saved over the
 * stored one. A change already owed keeps its earlier lines, so a page that changes back still
 * flags what was written from the version in between.
 */
export async function oweSourceChangeNotice({
  changedAt,
  sourceId,
  text,
  topic,
  tx,
}: {
  changedAt: Date;
  sourceId: string;
  text: string | null;
  topic: SourceTopic;
  tx: TransactionClient;
}): Promise<void> {
  if (!hasOwnFreshnessChecks(topic)) {
    return;
  }

  const stored = await tx.source.findUniqueOrThrow({
    select: { contentHash: true, extractedText: true, unnoticedChange: true },
    where: { id: sourceId },
  });

  const change = summarizeTextChange({ current: text, previous: stored.extractedText });

  if (!change) {
    return;
  }

  const owed = stored.unnoticedChange;

  await tx.unnoticedSourceChange.upsert({
    create: { changedAt, changes: change, previousHash: stored.contentHash, sourceId },
    update: {
      changedAt,
      changes: owed ? appendTextChange({ earlier: owed.changes, later: change }) : change,
    },
    where: { sourceId },
  });
}

export async function readOwedSourceChange(sourceId: string): Promise<OwedSourceChange | null> {
  const owed = await prisma.unnoticedSourceChange.findUnique({
    include: { source: { select: { contentHash: true } } },
    where: { sourceId },
  });

  return (
    owed && {
      change: owed.changes,
      changedAt: owed.changedAt,
      contentHash: owed.source.contentHash,
      previousHash: owed.previousHash,
    }
  );
}
