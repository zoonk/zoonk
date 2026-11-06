import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { type SourceTopic, hasOwnFreshnessChecks } from "./source-contract";
import { summarizeTextChange } from "./text-change";

export type OwedSourceChange = {
  change: string;
  changedAt: Date;
  contentHash: string;
  previousHash: string;
};

/**
 * Call in the transaction that moves the source's `contentHash`, before the new text is saved. A
 * change already owed keeps its older text, so its notice covers both.
 */
export async function oweSourceChangeNotice({
  changedAt,
  sourceId,
  topic,
  tx,
}: {
  changedAt: Date;
  sourceId: string;
  topic: SourceTopic;
  tx: TransactionClient;
}): Promise<void> {
  if (!hasOwnFreshnessChecks(topic)) {
    return;
  }

  const previous = await tx.source.findUniqueOrThrow({
    select: { contentHash: true, extractedText: true },
    where: { id: sourceId },
  });

  await tx.unnoticedSourceChange.upsert({
    create: {
      changedAt,
      previousHash: previous.contentHash,
      previousText: previous.extractedText,
      sourceId,
    },
    update: { changedAt },
    where: { sourceId },
  });
}

/** Settles a change with nothing to tell, such as articles moved around or a page changed back. */
export async function readOwedSourceChange(sourceId: string): Promise<OwedSourceChange | null> {
  const owed = await prisma.unnoticedSourceChange.findUnique({
    include: { source: { select: { contentHash: true, extractedText: true } } },
    where: { sourceId },
  });

  if (!owed) {
    return null;
  }

  const change = summarizeTextChange({
    current: owed.source.extractedText,
    previous: owed.previousText,
  });

  if (!change) {
    await prisma.unnoticedSourceChange.deleteMany({
      where: { changedAt: owed.changedAt, sourceId },
    });

    return null;
  }

  return {
    change,
    changedAt: owed.changedAt,
    contentHash: owed.source.contentHash,
    previousHash: owed.previousHash,
  };
}
