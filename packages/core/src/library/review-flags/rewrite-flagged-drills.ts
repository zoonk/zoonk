import "server-only";
import { type StatuteDrill } from "@zoonk/ai/tasks/v2/items/statute-drills";
import { prisma } from "@zoonk/db";
import { type LibraryProvenance, toProvenanceData } from "../_utils/library-rows";
import { checkItem } from "../items/item-checks";
import { toStoredItem } from "../items/item-content";
import { resolveReviewFlags } from "../sources/content-review-flags";
import { type FlaggedDrillGroup } from "./flagged-content";

/**
 * Writes a changed article's new drills into the flagged drills it replaces, one for one and in
 * place, so their ids (and the answers, screens and practice pointing at them) stay. A new drill
 * that fails the item checks leaves its old one flagged for the next run. Returns how many were
 * rewritten.
 *
 * This is a workflow bridge: the flag sweep generated the drills from the group it listed.
 */
export async function replaceFlaggedDrills({
  drills,
  group,
  optionCount,
  provenance,
}: {
  drills: readonly StatuteDrill[];
  group: FlaggedDrillGroup;
  optionCount: number;
  provenance: LibraryProvenance;
}): Promise<number> {
  const writtenAt = new Date(provenance.generatedAt);

  const pairs = group.itemIds.flatMap((itemId, index) => {
    const drill = drills.filter((candidate) => candidate.format === group.format)[index];

    if (!drill) {
      return [];
    }

    const { reference: _reference, ...item } = drill;
    const problems = checkItem({ expectedFormat: group.format, item, optionCount });

    return problems.length === 0 ? [{ item, itemId }] : [];
  });

  await prisma.$transaction(async (tx) => {
    await Promise.all(
      pairs.map(({ item, itemId }, index) =>
        tx.item.update({
          data: {
            ...toStoredItem(item),
            ...toProvenanceData({ ...provenance, runId: `${provenance.runId}:${index}` }),
            discrimination: null,
            sourceCitation: group.citation,
          },
          where: { id: itemId },
        }),
      ),
    );

    await Promise.all(
      pairs.map(({ itemId }) => resolveReviewFlags({ target: { itemId }, tx, writtenAt })),
    );
  });

  return pairs.length;
}
