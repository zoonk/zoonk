import { type GeneratedItem, type ItemFormat } from "@zoonk/ai/tasks/v2/items/schemas";
import { type Item, type ItemSet, type ItemSetKind, prisma } from "@zoonk/db";
import { type LibraryProvenance, toProvenanceData } from "../_utils/library-rows";
import { type RejectedItem, toCheckedItem } from "./create-items";
import { type ItemAnswerFormat, toStoredItem } from "./item-content";
import { parseItemSetContent } from "./item-set-content";

/** One question of a set, on the skill it tests (a set's questions can test different skills). */
type SetItem = ItemAnswerFormat & { format: ItemFormat; item: GeneratedItem; skillId: string };

/**
 * Stores a shared stimulus (a recording, a text, a case) with the questions on it that pass the
 * item checks, after code repaired what it can (`toCheckedItem`), in the order given: the order a
 * learner meets them, which for a recording is the order the answers are heard in. A question the
 * checks reject is left out and reported, and the others keep their order; with none left (or
 * fewer than `minItems`), no set is stored. The stimulus's own file (`mediaAssetId`) is added
 * later, by whoever makes it.
 *
 * The stimulus must be its kind's shape (`parseItemSetContent`); one that isn't throws. A workflow
 * step can retry after its transaction committed, so a run that already stored this stimulus
 * returns its set instead of storing a copy, while another set the same run writes is its own. An
 * internal workflow bridge: sets are shared Library content and no learner's data is written.
 */
export async function createItemSet({
  content,
  examBlueprintId = null,
  items,
  kind,
  language,
  minItems = 1,
  optionCount = null,
  provenance,
}: {
  /** The stimulus, in the shape its kind stores (`listeningContentSchema` for a recording). */
  content: object;
  examBlueprintId?: string | null;
  items: readonly SetItem[];
  kind: ItemSetKind;
  language: string;
  /** The fewest questions the set is asked with; with fewer passing, no set is stored. */
  minItems?: number;
  /** Options every multiple-choice question must have, from the exam format. */
  optionCount?: number | null;
  provenance: LibraryProvenance;
}): Promise<{ rejected: RejectedItem[]; set: (ItemSet & { items: Item[] }) | null }> {
  parseItemSetContent({ content, kind });

  const checked = items.map(({ entry, format, item, select, skillId }, index) => ({
    ...toCheckedItem({
      answerFormat: { entry, select },
      format,
      index,
      item,
      language,
      optionCount,
    }),
    answerFormat: { entry, select },
    skillId,
  }));

  const passing = checked.filter((question) => question.problems.length === 0);

  const rejected = checked.flatMap(({ index, problems }) =>
    problems.length > 0 ? [{ index, problems }] : [],
  );

  if (passing.length === 0 || passing.length < minItems) {
    return { rejected, set: null };
  }

  const shared = { examBlueprintId, language };

  const set = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.itemSet.findFirst({
      include: { items: { orderBy: { setPosition: "asc" } } },
      where: { content: { equals: content }, examBlueprintId, kind, runId: provenance.runId },
    });

    if (existing) {
      return existing;
    }

    return transaction.itemSet.create({
      data: {
        ...shared,
        content,
        items: {
          create: passing.map(({ answerFormat, item, skillId }, position) => ({
            ...toStoredItem(item, answerFormat),
            ...shared,
            setPosition: position,
            skillId,
            ...toProvenanceData(provenance),
          })),
        },
        kind,
        ...toProvenanceData(provenance),
      },
      include: { items: { orderBy: { setPosition: "asc" } } },
    });
  });

  return { rejected, set };
}
