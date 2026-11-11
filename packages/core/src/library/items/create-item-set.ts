import { type GeneratedItem, type ItemFormat } from "@zoonk/ai/tasks/items/schemas";
import { type Item, type ItemSet, type ItemSetKind, prisma } from "@zoonk/db";
import { type LibraryProvenance, toProvenanceData } from "../_utils/library-rows";
import { type KeyCheckedItem, type KeyedFormat } from "./check-item-keys";
import { type RejectedItem, toCheckedItem } from "./create-items";
import { toStoredItem } from "./item-content";
import { parseItemSetContent } from "./item-set-content";

export type WrittenSetItem = { format: ItemFormat; item: GeneratedItem; skillId: string };

/** A format whose key a blind solve can check takes only the items `checkItemSetKeys` kept. */
type SetItem =
  | { format: Exclude<ItemFormat, KeyedFormat>; item: GeneratedItem; skillId: string }
  | { format: ItemFormat; item: KeyCheckedItem; skillId: string };

export type ItemSetToStore<Question = SetItem> = {
  content: object;
  examBlueprintId?: string | null;
  items: readonly Question[];
  kind: ItemSetKind;
  language: string;
  minItems?: number;
  optionCount?: number | null;
  provenance: LibraryProvenance;
  /** A language exam's options are in the practiced language, so their numbers are read its way. */
  optionLanguage?: string | null;
};

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
  optionLanguage = null,
}: ItemSetToStore): Promise<{
  rejected: RejectedItem[];
  set: (ItemSet & { items: Item[] }) | null;
}> {
  parseItemSetContent({ content, kind });

  const checked = items.map(({ format, item, skillId }, index) => ({
    ...toCheckedItem({
      answerFormat: {},
      format,
      index,
      item,
      language,
      optionCount,
      optionLanguage,
    }),
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
          create: passing.map(({ item, skillId }, position) => ({
            ...toStoredItem(item, {}),
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
