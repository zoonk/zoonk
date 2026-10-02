import { type TransactionClient } from "@zoonk/db";

export type GuestLinkContext = {
  guestUserId: string;
  transaction: TransactionClient;
  userId: string;
};

/**
 * Returns the guest rows the account already has a row for. On a unique learner key (a skill, a
 * vote, a milestone) the account's row wins, since it's the learner's longer history, and the
 * guest's duplicate is dropped before the rest move over.
 */
function getDuplicateGuestRowIds<Row extends { id: string }>({
  accountKeys,
  guestRows,
  keyOf,
}: {
  accountKeys: string[];
  guestRows: Row[];
  keyOf: (row: Row) => string;
}): string[] {
  const existingKeys = new Set(accountKeys);

  return guestRows.filter((row) => existingKeys.has(keyOf(row))).map((row) => row.id);
}

async function moveLearnerSkills({ guestUserId, transaction, userId }: GuestLinkContext) {
  const guestRows = await transaction.learnerSkill.findMany({
    select: { id: true, skillId: true },
    where: { userId: guestUserId },
  });

  const accountRows = await transaction.learnerSkill.findMany({
    select: { skillId: true },
    where: { skillId: { in: guestRows.map((row) => row.skillId) }, userId },
  });

  const duplicateIds = getDuplicateGuestRowIds({
    accountKeys: accountRows.map((row) => row.skillId),
    guestRows,
    keyOf: (row) => row.skillId,
  });

  await transaction.learnerSkill.deleteMany({ where: { id: { in: duplicateIds } } });

  await transaction.learnerSkill.updateMany({ data: { userId }, where: { userId: guestUserId } });
}

async function moveMilestones({ guestUserId, transaction, userId }: GuestLinkContext) {
  const [guestRows, accountRows] = await Promise.all([
    transaction.milestone.findMany({
      select: { id: true, key: true, kind: true },
      where: { userId: guestUserId },
    }),
    transaction.milestone.findMany({ select: { key: true, kind: true }, where: { userId } }),
  ]);

  const duplicateIds = getDuplicateGuestRowIds({
    accountKeys: accountRows.map((row) => `${row.kind}:${row.key}`),
    guestRows,
    keyOf: (row) => `${row.kind}:${row.key}`,
  });

  await transaction.milestone.deleteMany({ where: { id: { in: duplicateIds } } });

  await transaction.milestone.updateMany({ data: { userId }, where: { userId: guestUserId } });
}

async function moveContentFeedback({ guestUserId, transaction, userId }: GuestLinkContext) {
  const guestRows = await transaction.contentFeedback.findMany({
    select: { contentId: true, contentKind: true, id: true },
    where: { userId: guestUserId },
  });

  const accountRows = await transaction.contentFeedback.findMany({
    select: { contentId: true, contentKind: true },
    where: { contentId: { in: guestRows.map((row) => row.contentId) }, userId },
  });

  const duplicateIds = getDuplicateGuestRowIds({
    accountKeys: accountRows.map((row) => `${row.contentKind}:${row.contentId}`),
    guestRows,
    keyOf: (row) => `${row.contentKind}:${row.contentId}`,
  });

  await transaction.contentFeedback.deleteMany({ where: { id: { in: duplicateIds } } });

  await transaction.contentFeedback.updateMany({
    data: { userId },
    where: { userId: guestUserId },
  });
}

async function moveUsageRecords({ guestUserId, transaction, userId }: GuestLinkContext) {
  const guestRows = await transaction.usageRecord.findMany({
    select: { id: true, kind: true, targetId: true },
    where: { userId: guestUserId },
  });

  const accountRows = await transaction.usageRecord.findMany({
    select: { kind: true, targetId: true },
    where: { targetId: { in: guestRows.map((row) => row.targetId) }, userId },
  });

  const duplicateIds = getDuplicateGuestRowIds({
    accountKeys: accountRows.map((row) => `${row.kind}:${row.targetId}`),
    guestRows,
    keyOf: (row) => `${row.kind}:${row.targetId}`,
  });

  await transaction.usageRecord.deleteMany({ where: { id: { in: duplicateIds } } });

  await transaction.usageRecord.updateMany({ data: { userId }, where: { userId: guestUserId } });
}

async function moveLearnerSources({ guestUserId, transaction, userId }: GuestLinkContext) {
  const guestRows = await transaction.learnerSource.findMany({
    select: { id: true, sourceId: true },
    where: { userId: guestUserId },
  });

  const accountRows = await transaction.learnerSource.findMany({
    select: { sourceId: true },
    where: { sourceId: { in: guestRows.map((row) => row.sourceId) }, userId },
  });

  const duplicateIds = getDuplicateGuestRowIds({
    accountKeys: accountRows.map((row) => row.sourceId),
    guestRows,
    keyOf: (row) => row.sourceId,
  });

  await transaction.learnerSource.deleteMany({ where: { id: { in: duplicateIds } } });

  await transaction.learnerSource.updateMany({ data: { userId }, where: { userId: guestUserId } });
}

/** Moves every guest row that has a per-learner unique key, keeping the account's on a clash. */
export async function moveKeyedRows(context: GuestLinkContext) {
  await moveLearnerSkills(context);
  await moveMilestones(context);
  await moveContentFeedback(context);
  await moveUsageRecords(context);
  await moveLearnerSources(context);
}
