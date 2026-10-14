import { type GeneratedItem, type ItemFormat } from "@zoonk/ai/tasks/v2/items/schemas";
import { type Item, prisma } from "@zoonk/db";
import { markPlansChanged } from "../../learner/_utils/mark-learner-changed";
import { resolvePlanInputDependents } from "../../plans/_utils/plan-input-dependencies";
import { type LibraryProvenance, toProvenanceData } from "../_utils/library-rows";
import { type ImageAnalytics } from "../media/_utils/plan-library-image";
import { drawItemImage, getItemImageRequest, loadItemImageScope } from "../media/item-images";
import { checkItem } from "./item-checks";
import { type ItemAnswerFormat, toStoredItem } from "./item-content";
import { repairItem } from "./item-repairs";

export type RejectedItem = { index: number; problems: string[] };

type CheckedItem = { index: number; item: GeneratedItem };

type ItemRows = {
  answerFormat: ItemAnswerFormat;
  examBlueprintId: string | null;
  field: string | null;
  format: ItemFormat;
  language: string;
  provenance: LibraryProvenance;
  skillId: string;
  sourceCitation: string | null;
  sourceId: string | null;
};

const PICTURE_FAILED = "Its picture couldn't be drawn, so the question can't be asked.";

/**
 * Stores one batch in a transaction. A retried step finds the rows its earlier attempt committed
 * (by run, skill and format, and whether they carry a picture, since pictured questions are
 * stored in a second batch) and returns them instead of storing copies.
 */
async function storeBatch({
  entries,
  pictured,
  rows,
}: {
  entries: readonly (CheckedItem & { mediaAssetId: string | null })[];
  pictured: boolean;
  rows: ItemRows;
}): Promise<Item[]> {
  const { answerFormat, format, provenance, skillId, ...shared } = rows;

  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.item.findMany({
      orderBy: { id: "asc" },
      where: {
        format,
        mediaAssetId: pictured ? { not: null } : null,
        runId: provenance.runId,
        skillId,
      },
    });

    if (existing.length > 0 || entries.length === 0) {
      return existing;
    }

    const planIds = await resolvePlanInputDependents(transaction, {
      blueprintIds: shared.examBlueprintId ? [shared.examBlueprintId] : [],
      skillIds: [skillId],
    });

    await markPlansChanged(transaction, { planIds });

    return transaction.item.createManyAndReturn({
      data: entries.map(({ item, mediaAssetId }) => ({
        ...toStoredItem(item, { ...answerFormat, citesSource: shared.sourceCitation !== null }),
        ...shared,
        mediaAssetId,
        skillId,
        ...toProvenanceData(provenance),
      })),
    });
  });
}

/** An item after code repaired what it can (`repairItem`), with what its checks still find. */
export function toCheckedItem({
  answerFormat,
  format,
  index,
  item: written,
  language,
  optionCount,
}: {
  answerFormat: ItemAnswerFormat;
  format: ItemFormat;
  index: number;
  item: GeneratedItem;
  language: string;
  optionCount: number | null;
}): CheckedItem & { problems: string[] } {
  const item = repairItem({ item: written, language, optionCount });

  const problems = checkItem({
    ...answerFormat,
    expectedFormat: format,
    item,
    language,
    optionCount,
  });

  return { index, item, problems };
}

/** Draws every picture the batch asks for at once; a question whose picture failed is dropped. */
async function drawPictures({
  analytics,
  entries,
  language,
  skillId,
}: {
  analytics?: ImageAnalytics;
  entries: readonly CheckedItem[];
  language: string;
  skillId: string;
}) {
  if (entries.length === 0) {
    return { drawn: [], failed: [], unchecked: [] };
  }

  const scope = await loadItemImageScope(skillId);

  const results = await Promise.all(
    entries.map(async (entry) => {
      const picture = await drawItemImage({ analytics, item: entry.item, language, scope });
      return { ...entry, mediaAssetId: picture?.assetId ?? null, picture };
    }),
  );

  return {
    drawn: results.filter((entry) => entry.mediaAssetId !== null),
    failed: results
      .filter((entry) => entry.mediaAssetId === null)
      .map(({ index }) => ({ index, problems: [PICTURE_FAILED] })),
    unchecked: results.flatMap((entry) => (entry.picture?.drawn ? [entry.picture.assetId] : [])),
  };
}

/**
 * Stores the generated items for a skill that pass the item checks, after code
 * repaired what it can (`repairItem`), and reports the rest, so a workflow can
 * log or regenerate them. Only checked
 * items reach learners. A question about a figure is stored only once its
 * picture is drawn, so no learner ever sees it without one; the questions
 * without a picture are stored meanwhile, so nobody waits on them. Pictures
 * drawn now (`unchecked`) get their model check in the background
 * (`checkImageAsset`): the caller starts it.
 *
 * A workflow step can retry after its insert committed, so a run that already
 * stored items for this skill in this format returns them instead of storing
 * copies (one run can write a skill's questions in several formats). This is
 * an internal workflow bridge: items are shared Library content. Each new batch
 * invalidates its dependent plans in the same transaction; retries change nothing.
 */
export async function createItems({
  analytics,
  entry,
  examBlueprintId = null,
  field = null,
  format,
  items,
  language,
  optionCount = null,
  provenance,
  select,
  skillId,
  sourceCitation = null,
  sourceId = null,
}: ItemAnswerFormat & {
  /** Who the pictures are drawn for, so their cost is counted with the questions'. */
  analytics?: ImageAnalytics;
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
}): Promise<{ created: Item[]; rejected: RejectedItem[]; unchecked: string[] }> {
  const answerFormat = { entry, select };

  const checked = items.map((item, index) =>
    toCheckedItem({ answerFormat, format, index, item, language, optionCount }),
  );

  const passing = checked.filter((checkedItem) => checkedItem.problems.length === 0);

  const rows = {
    answerFormat,
    examBlueprintId,
    field,
    format,
    language,
    provenance,
    skillId,
    sourceCitation,
    sourceId,
  };

  const [plain, pictures] = await Promise.all([
    storeBatch({
      entries: passing
        .filter((checkedItem) => !getItemImageRequest(checkedItem.item))
        .map((checkedItem) => ({ ...checkedItem, mediaAssetId: null })),
      pictured: false,
      rows,
    }),
    drawPictures({
      analytics,
      entries: passing.filter((checkedItem) => getItemImageRequest(checkedItem.item)),
      language,
      skillId,
    }),
  ]);

  const pictured = await storeBatch({ entries: pictures.drawn, pictured: true, rows });

  return {
    created: [...plain, ...pictured],
    rejected: [
      ...checked
        .filter((checkedItem) => checkedItem.problems.length > 0)
        .map(({ index, problems }) => ({ index, problems })),
      ...pictures.failed,
    ],
    unchecked: pictures.unchecked,
  };
}
