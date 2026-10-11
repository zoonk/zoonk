import { type ItemSet, type ItemSetKind, type MediaAsset, prisma } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { toListeningSetView } from "../listening/listening-set-view";
import { getItemAudienceFilter } from "./item-field";
import { parseItemSetContent } from "./item-set-content";
import { type ItemSetView } from "./item-set-view";

/** A set as practice and mocks pick it: its questions in order and the skills they test. */
export type ItemSetPick = {
  /** The exam the set was written for; null for a general one. */
  examBlueprintId: string | null;
  id: string;
  items: { id: string; skillId: string }[];
  kind: ItemSetKind;
  /** When the learner last answered one of its questions; null when never. */
  lastAnsweredAt: Date | null;
  skillIds: string[];
};

/**
 * The sets a learner may get with a question on any of the skills, whole, for practice and mocks
 * to pick: general ones and the goal's exam's, never another exam's, and a recording only once
 * it's voiced. Never-answered sets come first, then the ones answered longest ago; within each,
 * the order they were written. Each set's questions are in the order a learner meets them.
 */
export async function listItemSetsForSkills({
  examBlueprintId,
  skillIds,
  userId,
}: {
  examBlueprintId: string | null;
  skillIds: readonly string[];
  userId: string;
}): Promise<ItemSetPick[]> {
  const sets = await prisma.itemSet.findMany({
    include: {
      items: {
        orderBy: { setPosition: "asc" },
        select: { id: true, skillId: true },
        where: getItemAudienceFilter({ examBlueprintId, inSets: true }),
      },
    },
    orderBy: { id: "asc" },
    where: {
      NOT: { kind: "audio", mediaAssetId: null },
      OR: [{ examBlueprintId: null }, ...(examBlueprintId ? [{ examBlueprintId }] : [])],
      items: { some: { skillId: { in: [...skillIds] } } },
    },
  });

  const answers = await prisma.attempt.groupBy({
    _max: { answeredAt: true },
    by: ["itemId"],
    where: { itemId: { in: sets.flatMap((set) => set.items.map((item) => item.id)) }, userId },
  });

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

/** What reads that show a set's questions include of each item: its set, with its file. */
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

/**
 * A question's set as it shows with the question (`ITEM_SET_INCLUDE` on the item), or null for a
 * question on its own; a recording's transcript only with `reveal`, once its questions are
 * answered. Stored content passed its checks, so a parse failure is logged and the question shows
 * without it instead of failing the learner.
 */
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
