import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { readSavedPlan } from "../../learner/facts/saved-plan";
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
  goal: Pick<Goal, "examBlueprintId" | "id" | "kind" | "userId"> | null;
}): Promise<Map<number, string>> {
  const payloads = blocks.map((block) => ({ block, payload: readBlockPayload(block) }));

  const planItemIds = payloads.flatMap(({ payload }) =>
    !payload.planSkillId && payload.planItemId ? [payload.planItemId] : [],
  );

  const chapterIds = [...new Set(payloads.flatMap(({ payload }) => payload.chapterId ?? []))];

  // The blocks' labels are read for the learner's screens, from the request's plan.
  const plan = goal ? await readSavedPlan(goal.userId, goal.id) : null;
  const blockItemIds = new Set(planItemIds);

  const [skillSubjects, chapterSkills] = await Promise.all([
    loadSkillSubjects(goal, blueprint, plan),
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

  const planItemSkills = new Map(
    (plan?.items ?? []).flatMap((item) =>
      blockItemIds.has(item.id) ? [[item.id, item.skillId] as const] : [],
    ),
  );

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
