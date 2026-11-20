import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { readSavedPlan } from "../../learner/facts/saved-plan";
import { loadPlanSubjects } from "../../view-models/syllabus/_utils/load-syllabus";
import { readBlockPayload } from "../block-payload";
import { type DayBlockView } from "../day-view";
import { getBlockSubject } from "./block-subject";
import { type DayBlockInput } from "./day-block-view";

export type BlockSubject = Pick<DayBlockView, "subject" | "subjectExtra">;

/** Empty for single-subject goals; labels use the plan item's skill when lesson skills are finer. */
export async function loadBlockSubjects({
  blocks,
  blueprint,
  goal,
}: {
  blocks: readonly DayBlockInput[];
  /** The goal's exam blueprint when a GET already read it (see `loadNotice`). */
  blueprint?: ExamBlueprint | null;
  goal: Pick<Goal, "examBlueprintId" | "id" | "kind" | "userId"> | null;
}): Promise<Map<number, BlockSubject>> {
  if (!goal) {
    return new Map();
  }

  const payloads = blocks.map((block) => ({ block, payload: readBlockPayload(block) }));

  const planItemIds = payloads.flatMap(({ payload }) =>
    !payload.planSkillId && payload.planItemId ? [payload.planItemId] : [],
  );

  const chapterIds = [...new Set(payloads.flatMap(({ payload }) => payload.chapterId ?? []))];

  const plan = await readSavedPlan(goal.userId, goal.id);
  const blockItemIds = new Set(planItemIds);

  const [{ graph, hasNotice, subjects: skillSubjects }, chapterSkills] = await Promise.all([
    loadPlanSubjects(goal, blueprint, plan),
    chapterIds.length > 0
      ? prisma.chapterSkill.findMany({
          select: { chapterId: true, skillId: true },
          where: { chapterId: { in: chapterIds } },
        })
      : [],
  ]);

  const extraIds = new Set(
    graph.skills.filter((skill) => skill.extra).map((skill) => skill.skillId),
  );

  if (skillSubjects.size === 0 && extraIds.size === 0) {
    return new Map();
  }

  const planItemSkills = new Map(
    (plan?.items ?? []).flatMap((item) =>
      blockItemIds.has(item.id) ? [[item.id, item.skillId] as const] : [],
    ),
  );

  return new Map(
    payloads.flatMap<readonly [number, BlockSubject]>(({ block, payload }) => {
      const planItemSkillId =
        payload.planSkillId ?? (payload.planItemId ? planItemSkills.get(payload.planItemId) : null);

      const extra = block.kind === "learn" && extraIds.has(planItemSkillId ?? "");

      if (extra) {
        return [
          [
            block.position,
            { subject: null, subjectExtra: hasNotice ? "notice" : "optional" },
          ] as const,
        ];
      }

      const subject = getBlockSubject({
        chapterSkillIds: chapterSkills.flatMap((row) =>
          row.chapterId === payload.chapterId ? [row.skillId] : [],
        ),
        planItemSkillId,
        skillIds: payload.skillIds,
        skillSubjects,
      });

      return subject ? [[block.position, { subject }] as const] : [];
    }),
  );
}
