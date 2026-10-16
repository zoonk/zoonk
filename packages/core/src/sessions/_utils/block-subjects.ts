import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { loadSkillSubjects } from "../../view-models/syllabus/_utils/load-syllabus";
import { readBlockPayload } from "../block-payload";
import { getBlockSubject } from "./block-subject";
import { type DayBlockInput } from "./day-block-view";

/**
 * Each block's subject by its short name, for Today's labels (see `getBlockSubject`). A lesson's
 * block falls back on the skill of its plan item: the one the block kept, or for blocks built
 * before it kept one, its plan item's while the item exists. Empty for goals with fewer than two
 * subjects.
 */
export async function loadBlockSubjects({
  blocks,
  blueprint,
  goal,
}: {
  blocks: readonly DayBlockInput[];
  /** The goal's exam blueprint when a GET already read it (see `loadNotice`). */
  blueprint?: ExamBlueprint | null;
  goal: Pick<Goal, "examBlueprintId" | "id" | "kind"> | null;
}): Promise<Map<number, string>> {
  const payloads = blocks.map((block) => ({ block, payload: readBlockPayload(block) }));

  const planItemIds = payloads.flatMap(({ payload }) =>
    !payload.planSkillId && payload.planItemId ? [payload.planItemId] : [],
  );

  const chapterIds = [...new Set(payloads.flatMap(({ payload }) => payload.chapterId ?? []))];

  const [skillSubjects, planItems, chapterSkills] = await Promise.all([
    loadSkillSubjects(goal, blueprint),
    planItemIds.length > 0
      ? prisma.planItem.findMany({
          select: { id: true, skillId: true },
          where: { id: { in: planItemIds } },
        })
      : [],
    chapterIds.length > 0
      ? prisma.chapterSkill.findMany({
          select: { chapterId: true, skillId: true },
          where: { chapterId: { in: chapterIds } },
        })
      : [],
  ]);

  if (skillSubjects.size === 0) {
    return new Map();
  }

  const planItemSkills = new Map(planItems.map((item) => [item.id, item.skillId]));

  return new Map(
    payloads.flatMap(({ block, payload }) => {
      const subject = getBlockSubject({
        chapterSkillIds: chapterSkills.flatMap((row) =>
          row.chapterId === payload.chapterId ? [row.skillId] : [],
        ),
        planItemSkillId:
          payload.planSkillId ??
          (payload.planItemId ? planItemSkills.get(payload.planItemId) : null),
        skillIds: payload.skillIds,
        skillSubjects,
      });

      return subject ? [[block.position, subject] as const] : [];
    }),
  );
}
