import "server-only";
import { type Goal, type StudySessionBlock, prisma } from "@zoonk/db";
import { loadSkillSubjects } from "../../view-models/syllabus/_utils/load-syllabus";
import { readBlockPayload } from "../block-payload";
import { getBlockSubject } from "./block-subject";

/**
 * Each block's subject by its short name, for Today's labels. A lesson's block names the skill of
 * its plan item, since the lesson's own skills are finer than the plan's: the one the block kept,
 * or for blocks built before it kept one, its plan item's while the item exists. Other blocks go
 * by their skills. Empty for goals with fewer than two subjects.
 */
export async function loadBlockSubjects({
  blocks,
  goal,
}: {
  blocks: readonly StudySessionBlock[];
  goal: Pick<Goal, "examBlueprintId" | "id" | "kind"> | null;
}): Promise<Map<string, string>> {
  const payloads = blocks.map((block) => ({ block, payload: readBlockPayload(block) }));

  const planItemIds = payloads.flatMap(({ payload }) =>
    !payload.planSkillId && payload.planItemId ? [payload.planItemId] : [],
  );

  const [skillSubjects, planItems] = await Promise.all([
    loadSkillSubjects(goal),
    planItemIds.length > 0
      ? prisma.planItem.findMany({
          select: { id: true, skillId: true },
          where: { id: { in: planItemIds } },
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
        planItemSkillId:
          payload.planSkillId ??
          (payload.planItemId ? planItemSkills.get(payload.planItemId) : null),
        skillIds: payload.skillIds,
        skillSubjects,
      });

      return subject ? [[block.id, subject] as const] : [];
    }),
  );
}
