import { type TransactionClient } from "@zoonk/db";
import { type StoredChange, contentFixChangesSchema } from "../contract";
import { targetsOf } from "./prepare-content-fix";

function keysOf(changes: readonly StoredChange[]): Set<string> {
  return new Set(
    changes.flatMap((change) =>
      targetsOf(change).map(({ id, model, part }) => `${model}:${id}:${part}`),
    ),
  );
}

/**
 * A revert puts back what one fix wrote, so it's stale once another fix has written any of the
 * same targets since; fixes to other fields of those rows leave it valid.
 */
export async function changedSince(
  tx: TransactionClient,
  { fixId, since, stored }: { fixId: string; since: Date; stored: StoredChange[] },
): Promise<boolean> {
  const targets = keysOf(stored);
  const rows = stored.flatMap((change) => targetsOf(change));

  const later = await tx.contentFix.findMany({
    select: { changes: true },
    where: {
      OR: rows.map(({ id, model }) => ({ changes: { array_contains: [{ id, model }] } })),
      decidedAt: { gt: since },
      id: { not: fixId },
      status: "applied",
    },
  });

  return later.some((fix) =>
    [...keysOf(contentFixChangesSchema.parse(fix.changes))].some((key) => targets.has(key)),
  );
}
