import "server-only";
import { prisma } from "@zoonk/db";
import { isSinglePick } from "../../learner/_utils/choice-items";
import { getItemAudienceFilter, getPublicItemFilter } from "../../library/items/item-field";
import {
  QUESTION_ITEM_FORMATS,
  type SessionItem,
  hasTraps,
  parseSessionItem,
} from "../../sessions/_utils/session-items";
import { type CheckpointItemCandidate } from "../checkpoint-rules";

/**
 * The questions on a set of skills a checkpoint can ask (choice questions and math problems), as
 * the bank holds them for everyone: another exam's never count, general ones and the goal's
 * exam's do. A duel is answered with one tap, so a question that asks for several options never
 * comes up.
 */
export async function listCheckpointQuestions({
  examBlueprintId,
  publicOnly = false,
  skillIds,
}: {
  examBlueprintId: string | null;
  /** For a read with no learner: only public material (see `getPublicItemFilter`). */
  publicOnly?: boolean;
  skillIds: readonly string[];
}): Promise<SessionItem[]> {
  const items = await prisma.item.findMany({
    orderBy: { id: "asc" },
    where: {
      AND: [
        getItemAudienceFilter({ examBlueprintId }),
        ...(publicOnly ? [getPublicItemFilter()] : []),
      ],
      format: { in: [...QUESTION_ITEM_FORMATS] },
      skillId: { in: [...skillIds] },
    },
  });

  return items
    .map((item) => parseSessionItem(item))
    .filter((item) => item !== null)
    .filter((item) => item.format !== "multipleChoice" || isSinglePick(item));
}

/**
 * Questions on a set of skills as checkpoint candidates (see `listCheckpointQuestions`): whether a
 * wrong answer carries a misconception (a classic trap) and whether the learner has seen the
 * question.
 */
export async function loadCheckpointCandidates({
  examBlueprintId,
  skillIds,
  userId,
}: {
  /** The goal's exam, if any. */
  examBlueprintId: string | null;
  skillIds: readonly string[];
  userId: string;
}): Promise<CheckpointItemCandidate[]> {
  const items = await listCheckpointQuestions({ examBlueprintId, skillIds });

  const seen = await prisma.attempt.findMany({
    distinct: ["itemId"],
    select: { itemId: true },
    where: { itemId: { in: items.map((item) => item.id) }, userId },
  });

  const seenIds = new Set(seen.map((attempt) => attempt.itemId));

  return items.map((item) => ({
    hasMisconceptions: hasTraps(item),
    id: item.id,
    seen: seenIds.has(item.id),
    skillId: item.skillId,
  }));
}
