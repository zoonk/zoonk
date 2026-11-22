import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import {
  type PlacementQuickFormat,
  getPlacementQuickFormat,
} from "../learner/placement/placement-quick-format";
import { readBlueprintContent } from "../library/exams/save-exam-blueprint";
import { listPastQuestionExamples } from "../library/items/past-question-examples";
import { loadUsedSituations } from "../library/items/used-situations";
import { getSkillArea } from "../plans/planner/graph-areas";
import { readItemExamPlan, toItemExam } from "./item-exam";
import { PLACEMENT_ITEM_SKILL_SELECT, type PlacementItemSkill } from "./placement-item-skills";

const SET_AREAS = 2;

const SKILLS_PER_SET = 3;

export type ItemSetTarget = {
  format: PlacementQuickFormat;
  /** Two or three skills of one area, each with the goal's exam and how its questions look. */
  skills: PlacementItemSkill[];
  usedTitles: string[];
};

function readTitle(content: unknown): string | null {
  return isJsonObject(content) && typeof content.title === "string" ? content.title : null;
}

/** Workflow bridge: goalId must come from the authenticated public boundary; non-exam goals return no targets. */
export async function pickItemSetTargets({
  goalId,
  mockSkillIds,
}: {
  goalId: string;
  mockSkillIds?: readonly string[];
}): Promise<ItemSetTarget[]> {
  const plan = await readItemExamPlan(goalId);

  if (!plan) {
    return [];
  }

  const { blueprint, firstPhase, graph, listening } = plan;

  const needed = mockSkillIds && new Set(mockSkillIds);

  const firstSkills = graph.skills.filter(
    (skill) =>
      (needed ? needed.has(skill.skillId) : skill.phase === firstPhase) &&
      !listening.has(skill.skillId),
  );

  const [rows, sets] = await Promise.all([
    prisma.skill.findMany({
      select: PLACEMENT_ITEM_SKILL_SELECT,
      where: { id: { in: firstSkills.map((skill) => skill.skillId) } },
    }),
    prisma.itemSet.findMany({
      select: { content: true, items: { select: { skillId: true } }, mockOnly: true },
      where: { examBlueprintId: blueprint.id },
    }),
  ]);

  const covered = new Set(
    sets.filter((set) => !set.mockOnly).flatMap((set) => set.items.map((item) => item.skillId)),
  );

  const usedTitles = sets.flatMap((set) => readTitle(set.content) ?? []);
  const exam = toItemExam(blueprint);
  const format = getPlacementQuickFormat(readBlueprintContent(blueprint).structure);

  const areas = Map.groupBy(firstSkills, (skill) =>
    JSON.stringify([
      getSkillArea({ graph, skill }),
      rows.find((row) => row.id === skill.skillId)?.country ?? null,
    ]),
  );

  const targets = [...areas.values()]
    .filter(
      (skills) =>
        skills.length >= 2 && (needed || !skills.some((skill) => covered.has(skill.skillId))),
    )
    .map((skills) => skills.toSorted((a, b) => (b.weight ?? 0) - (a.weight ?? 0)))
    .toSorted((a, b) => (b[0]?.weight ?? 0) - (a[0]?.weight ?? 0))
    .slice(0, SET_AREAS)
    .map((skills) => ({
      format,
      skills: skills
        .slice(0, SKILLS_PER_SET)
        .flatMap((skill) => rows.find((row) => row.id === skill.skillId) ?? [])
        .map((row) => ({ ...row, exam, usedSituations: [] })),
      usedTitles,
    }))
    .filter((target) => target.skills.length >= 2);

  if (needed) {
    return targets;
  }

  const usedSituations = await loadUsedSituations({
    examBlueprintId: blueprint.id,
    includeMockReserve: true,
    skillIds: targets.flatMap((target) => target.skills.map((skill) => skill.id)),
  });

  return Promise.all(
    targets.map(async (target) => {
      const pastQuestions = await listPastQuestionExamples({
        examBlueprintId: blueprint.id,
        skillIds: target.skills.map((skill) => skill.id),
      });

      return {
        ...target,
        skills: target.skills.map((skill) => ({
          ...skill,
          exam: { ...exam, pastQuestions },
          usedSituations: usedSituations.get(skill.id) ?? [],
        })),
      };
    }),
  );
}
