import { type ItemSet, type ItemSetKind, type MediaAsset, prisma } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { toListeningSetView } from "../listening/listening-set-view";
import { getItemAudienceFilter, getPublicItemFilter, getPublicMaterialFilters } from "./item-field";
import { parseItemSetContent } from "./item-set-content";
import { type ItemSetView } from "./item-set-view";

export type ItemSetPick = {
  examBlueprintId: string | null;
  id: string;
  items: { id: string; skillId: string }[];
  kind: ItemSetKind;
  lastAnsweredAt: Date | null;
  skillIds: string[];
};

export async function listItemSetsForSkills({
  examBlueprintId,
  skillIds,
  userId,
}: {
  examBlueprintId: string | null;
  skillIds: readonly string[];
  userId: string | null;
}): Promise<ItemSetPick[]> {
  const sets = await prisma.itemSet.findMany({
    include: {
      items: {
        orderBy: { setPosition: "asc" },
        select: { id: true, skillId: true },
        where: {
          AND: [
            getItemAudienceFilter({ examBlueprintId, inSets: true }),
            ...(userId ? [] : [getPublicItemFilter()]),
          ],
        },
      },
    },
    orderBy: { id: "asc" },
    where: {
      NOT: { kind: "audio", mediaAssetId: null },
      OR: [{ examBlueprintId: null }, ...(examBlueprintId ? [{ examBlueprintId }] : [])],
      items: { some: { skillId: { in: [...skillIds] } } },
      ...(userId ? {} : { AND: getPublicMaterialFilters() }),
    },
  });

  const answers = userId
    ? await prisma.attempt.groupBy({
        _max: { answeredAt: true },
        by: ["itemId"],
        where: { itemId: { in: sets.flatMap((set) => set.items.map((item) => item.id)) }, userId },
      })
    : [];

  const lastAnswers = new Map(answers.map((answer) => [answer.itemId, answer._max.answeredAt]));

  return sets
    .map((set) => {
      const answeredAt = set.items.flatMap((item) => lastAnswers.get(item.id) ?? []);

      return {
        examBlueprintId: set.examBlueprintId,
        id: set.id,
        items: set.items,
        kind: set.kind,
        lastAnsweredAt:
          answeredAt.length > 0 ? new Date(Math.max(...answeredAt.map(Number))) : null,
        skillIds: [...new Set(set.items.map((item) => item.skillId))],
      };
    })
    .filter((set) => set.items.length > 0)
    .toSorted((a, b) => Number(a.lastAnsweredAt ?? 0) - Number(b.lastAnsweredAt ?? 0));
}

export const ITEM_SET_INCLUDE = {
  set: {
    include: {
      _count: { select: { items: true } },
      mediaAsset: { select: { durationMs: true, url: true } },
    },
  },
} as const;

type SetRow = ItemSet & {
  _count: { items: number };
  mediaAsset: Pick<MediaAsset, "durationMs" | "url"> | null;
};

function toStimulus({
  reveal,
  set,
}: {
  reveal: boolean;
  set: SetRow;
}): Omit<ItemSetView, "count" | "id" | "kind" | "position"> {
  const parsed = parseItemSetContent({ content: set.content, kind: set.kind });

  if (parsed.kind === "audio") {
    const listening = toListeningSetView({
      content: parsed.content,
      mediaAsset: set.mediaAsset,
      reveal,
    });

    return { listening, source: null, text: null, title: parsed.content.title, visual: null };
  }

  const visual = parsed.kind === "chart" ? parsed.content.visual : null;
  const { source, text, title } = parsed.content;

  return { listening: null, source, text, title, visual };
}

/** A recording's transcript is included only with `reveal`; malformed content is logged and omitted. */
export function toItemSetView({
  item,
  reveal = false,
}: {
  item: { set: SetRow | null; setPosition: number | null };
  reveal?: boolean;
}): ItemSetView | null {
  const { set } = item;

  if (!set) {
    return null;
  }

  try {
    return {
      ...toStimulus({ reveal, set }),
      count: set._count.items,
      id: set.id,
      kind: set.kind,
      position: item.setPosition ?? 0,
    };
  } catch (error) {
    logError(`Item set ${set.id} has content that doesn't match its kind.`, error);
    return null;
  }
}
