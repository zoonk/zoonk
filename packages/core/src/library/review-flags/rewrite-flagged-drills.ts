import "server-only";
import { type StatuteDrill } from "@zoonk/ai/tasks/items/statute-drills";
import { type LibraryProvenance, toProvenanceData } from "../_utils/library-rows";
import { lockPlanSourceWrite, writePlanInputs } from "../_utils/plan-input-write";
import { checkItem } from "../items/item-checks";
import { toStoredItem } from "../items/item-content";
import { repairItem } from "../items/item-repairs";
import { reconcileItemReviewFlags } from "../sources/content-review-flags";
import { type FlaggedDrillGroup, recordFailedDrillRewrites } from "./flagged-content";

/** Internal workflow bridge: the drills must come from the flagged group the sweep listed. */
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
  const pairs = group.itemIds.flatMap((itemId, index) => {
    const drill = drills.filter((candidate) => candidate.format === group.format)[index];

    if (!drill) {
      return [];
    }

    const { reference: _reference, ...written } = drill;
    const item = repairItem({ item: written, language: group.language, optionCount });

    const problems = checkItem({
      expectedFormat: group.format,
      item,
      language: group.language,
      optionCount,
    });

    return problems.length === 0 ? [{ item, itemId }] : [];
  });

  await writePlanInputs(async (tx) => {
    const rewritten = await tx.item.findMany({
      select: { examBlueprintId: true, skillId: true },
      where: { id: { in: pairs.map(({ itemId }) => itemId) } },
    });

    await lockPlanSourceWrite(tx, {
      blueprintIds: [...new Set(rewritten.flatMap(({ examBlueprintId }) => examBlueprintId ?? []))],
      skillIds: [...new Set(rewritten.map(({ skillId }) => skillId))],
    });

    await Promise.all(
      pairs.map(({ item, itemId }, index) =>
        tx.item.update({
          data: {
            ...toStoredItem(item, { citesSource: true }),
            ...toProvenanceData({ ...provenance, runId: `${provenance.runId}:${index}` }),
            discrimination: null,
            sourceCitation: group.citation,
            sourceHash: group.sourceHash,
          },
          where: { id: itemId },
        }),
      ),
    );

    await recordFailedDrillRewrites({
      itemIds: group.itemIds.filter((id) => !pairs.some((pair) => pair.itemId === id)),
      preparedAt: group.preparedAt,
      tx,
    });

    await reconcileItemReviewFlags(tx, {
      itemIds: pairs.map(({ itemId }) => itemId),
      source: { contentHash: group.sourceHash, sourceId: group.sourceId },
    });
  });

  return pairs.length;
}
