import { type GeneratedItem, type ItemFormat } from "@zoonk/ai/tasks/v2/items/schemas";
import { type Item, prisma } from "@zoonk/db";
import { type LibraryProvenance, toProvenanceData } from "../_utils/library-rows";
import { checkItem } from "./item-checks";
import { toStoredItem } from "./item-content";

type RejectedItem = { index: number; problems: string[] };

/**
 * Stores the generated items for a skill that pass the item checks and
 * reports the rest, so a workflow can log or regenerate them. Only checked
 * items reach learners.
 *
 * A workflow step can retry after its insert committed, so a run that already
 * stored items for this skill in this format returns them instead of storing
 * copies (one run can write a skill's questions in several formats). This is
 * an internal workflow bridge: items are shared Library content and no
 * learner's data is written.
 */
export async function createItems({
  examBlueprintId = null,
  field = null,
  format,
  items,
  language,
  optionCount = null,
  provenance,
  skillId,
  sourceCitation = null,
  sourceId = null,
}: {
  examBlueprintId?: string | null;
  field?: string | null;
  /** The format the items were generated for. */
  format: ItemFormat;
  items: readonly GeneratedItem[];
  language: string;
  /** Options every multiple-choice item must have, from the exam format. */
  optionCount?: number | null;
  provenance: LibraryProvenance;
  skillId: string;
  sourceCitation?: string | null;
  sourceId?: string | null;
}): Promise<{ created: Item[]; rejected: RejectedItem[] }> {
  const checked = items.map((item, index) => ({
    index,
    item,
    problems: checkItem({ expectedFormat: format, item, optionCount }),
  }));

  const rejected = checked
    .filter((entry) => entry.problems.length > 0)
    .map(({ index, problems }) => ({ index, problems }));

  const passing = checked.filter((entry) => entry.problems.length === 0);

  const created = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.item.findMany({
      orderBy: { id: "asc" },
      where: { format, runId: provenance.runId, skillId },
    });

    if (existing.length > 0 || passing.length === 0) {
      return existing;
    }

    return transaction.item.createManyAndReturn({
      data: passing.map(({ item }) => ({
        ...toStoredItem(item),
        examBlueprintId,
        field,
        language,
        skillId,
        sourceCitation,
        sourceId,
        ...toProvenanceData(provenance),
      })),
    });
  });

  return { created, rejected };
}
