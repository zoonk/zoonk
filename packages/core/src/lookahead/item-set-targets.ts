import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { toListeningExam } from "../exams/listening/listening-exam";
import { getListeningSkillIds } from "../exams/listening/listening-skills";
import {
  type PlacementQuickFormat,
  getPlacementQuickFormat,
} from "../learner/placement/placement-quick-format";
import { readBlueprintContent } from "../library/exams/save-exam-blueprint";
import { listPastQuestionExamples } from "../library/items/past-question-examples";
import { getSkillArea } from "../plans/planner/graph-areas";
import { parsePlanGraph } from "../plans/planner/plan-state";
import { type PlacementItemSkill, toItemExam } from "./placement-item-skills";

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
export async function pickItemSetTargets({ goalId }: { goalId: string }): Promise<ItemSetTarget[]> {
  const goal = await prisma.goal.findUnique({
    select: {
      examBlueprint: true,
      kind: true,
      plan: { select: { graph: true } },
      targetLanguage: true,
    },
    where: { id: goalId },
  });

  const blueprint = goal?.kind === "exam" ? goal.examBlueprint : null;

  if (!blueprint) {
    return [];
  }

  const graph = parsePlanGraph(goal?.plan?.graph);
  const firstPhase = Math.min(...graph.skills.map((skill) => skill.phase));

  // Listening skills need recordings rather than text passages about conversations.
  const listening = goal ? getListeningSkillIds({ exam: toListeningExam(goal), graph }) : new Set();

  const firstSkills = graph.skills.filter(
    (skill) => skill.phase === firstPhase && !listening.has(skill.skillId),
  );

  const [rows, sets] = await Promise.all([
    prisma.skill.findMany({
      select: {
        description: true,
        id: true,
        language: true,
        level: true,
        name: true,
        ownerId: true,
        targetLanguage: true,
      },
      where: { id: { in: firstSkills.map((skill) => skill.skillId) } },
    }),
    prisma.itemSet.findMany({
      select: { content: true, items: { select: { skillId: true } } },
      where: { examBlueprintId: blueprint.id },
    }),
  ]);

  const covered = new Set(sets.flatMap((set) => set.items.map((item) => item.skillId)));
  const usedTitles = sets.flatMap((set) => readTitle(set.content) ?? []);
  const exam = toItemExam(blueprint);
  const format = getPlacementQuickFormat(readBlueprintContent(blueprint).structure);
  const areas = Map.groupBy(firstSkills, (skill) => getSkillArea({ graph, skill }));

  const targets = [...areas.values()]
    .filter((skills) => skills.length >= 2 && !skills.some((skill) => covered.has(skill.skillId)))
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

  return Promise.all(
    targets.map(async (target) => {
      const pastQuestions = await listPastQuestionExamples({
        examBlueprintId: blueprint.id,
        skillIds: target.skills.map((skill) => skill.id),
      });

      return {
        ...target,
        skills: target.skills.map((skill) => ({ ...skill, exam: { ...exam, pastQuestions } })),
      };
    }),
  );
}
