import { type TransactionClient } from "@zoonk/db";
import { type StoredChange, contentFixChangesSchema } from "../contract";

/** What a change writes: each field it sets, or a question's retirement, or a screen's picture. */
function targetsOf(change: StoredChange): string[] {
  const row = `${change.model}:${change.id}`;

  switch (change.op) {
    case "set":
      return change.fields.map(({ field }) => `${row}:${field}`);
    case "retire":
    case "unretire":
      return [`${row}:retired`];
    case "detachPicture":
    case "attachPicture":
      return [`${row}:picture`];
    default:
      throw new Error("Unknown stored change");
  }
}

/**
 * A revert puts back what one fix wrote, so it's stale once another fix has written any of the
 * same targets since; fixes to other fields of those rows leave it valid.
 */
export async function changedSince(
  tx: TransactionClient,
  { fixId, since, stored }: { fixId: string; since: Date; stored: StoredChange[] },
): Promise<boolean> {
  const targets = new Set(stored.flatMap((change) => targetsOf(change)));

  const later = await tx.contentFix.findMany({
    select: { changes: true },
    where: {
      OR: stored.map(({ id, model }) => ({ changes: { array_contains: [{ id, model }] } })),
      decidedAt: { gt: since },
      id: { not: fixId },
      status: "applied",
    },
  });

  return later.some((fix) =>
    contentFixChangesSchema
      .parse(fix.changes)
      .some((change) => targetsOf(change).some((target) => targets.has(target))),
  );
}
