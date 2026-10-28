import { type GeneratedItem, type ItemFormat } from "@zoonk/ai/tasks/v2/items/schemas";
import { type Item } from "@zoonk/db";
import { type LibraryProvenance, toProvenanceData } from "../_utils/library-rows";
import { lockPlanSourceWrite, writePlanInputs } from "../_utils/plan-input-write";
import { type ImageAnalytics } from "../media/_utils/draw-library-image";
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

  return writePlanInputs(async (transaction) => {
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

    await lockPlanSourceWrite(transaction, {
      blueprintIds: shared.examBlueprintId ? [shared.examBlueprintId] : [],
      skillIds: [skillId],
    });

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

/** Internal workflow bridge for shared content; callers must start background checks for returned `unchecked` pictures. */
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
  analytics?: ImageAnalytics;
  examBlueprintId?: string | null;
  field?: string | null;
  format: ItemFormat;
  items: readonly GeneratedItem[];
  language: string;
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
