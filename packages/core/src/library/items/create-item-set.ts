import { type GeneratedItem, type ItemFormat } from "@zoonk/ai/tasks/v2/items/schemas";
import { type Item, type ItemSet, type ItemSetKind, prisma } from "@zoonk/db";
import { type LibraryProvenance, toProvenanceData } from "../_utils/library-rows";
import { type RejectedItem, toCheckedItem } from "./create-items";
import { type ItemAnswerFormat, toStoredItem } from "./item-content";
import { parseItemSetContent } from "./item-set-content";

type SetItem = ItemAnswerFormat & { format: ItemFormat; item: GeneratedItem; skillId: string };

/** Throws if the stimulus does not match its kind's schema; retries of the same run reuse its stored set. */
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
  content: object;
  examBlueprintId?: string | null;
  items: readonly SetItem[];
  kind: ItemSetKind;
  language: string;
  minItems?: number;
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
