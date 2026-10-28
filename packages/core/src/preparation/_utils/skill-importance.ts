import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { type ExamChoice } from "../../exams/choices/exam-choices";
import { getItemAudienceFilter } from "../../library/items/item-field";
import { loadExamFacts } from "../../plans/_utils/planner-exam-facts";
import { readCourseWeights } from "../../plans/planner/course-weights";
import { weighGraphForExam } from "../../plans/planner/exam-weights";
import { type PlanGraph } from "../../plans/planner/plan-state";
import { getSkillImportance } from "../preparation-math";

type ImportanceSkill = { memberSkillIds: readonly string[]; skillId: string };

async function loadBankDifficulty({
  examBlueprintId,
  skillIds,
}: {
  examBlueprintId: string | null;
  skillIds: string[];
}): Promise<Map<string, { count: number; sum: number }>> {
  const rows = await prisma.item.groupBy({
    _avg: { difficulty: true },
    _count: { difficulty: true },
    by: ["skillId"],
    where: {
      difficulty: { not: null },
      skillId: { in: skillIds },
      ...getItemAudienceFilter({ examBlueprintId }),
    },
  });

  return new Map(
    rows.map((row) => [
      row.skillId,
      { count: row._count.difficulty, sum: (row._avg.difficulty ?? 0) * row._count.difficulty },
    ]),
  );
}

function getGraphDifficulty({ graph, phase }: { graph: PlanGraph; phase: number | null }) {
  const last = Math.max(0, ...graph.skills.map((skill) => skill.phase));
  return phase === null || last === 0 ? 0 : phase / last - 1 / 2;
}

export async function loadSkillImportance({
  blueprint,
  choices,
  goal,
  graph,
  skills,
  survivorOf,
}: {
  blueprint?: ExamBlueprint | null;
  choices: readonly ExamChoice[];
  goal: Pick<Goal, "details" | "examBlueprintId" | "kind"> | null;
  graph: PlanGraph;
  skills: readonly ImportanceSkill[];
  survivorOf: (skillId: string) => string;
}): Promise<{ importance: Map<string, number>; sectionWeights: Map<string, number> | null }> {
  const members = [...new Set(skills.flatMap((skill) => skill.memberSkillIds))];

  const [facts, bank] = await Promise.all([
    goal ? loadExamFacts({ blueprint, choices, goal, graph }) : null,
    loadBankDifficulty({ examBlueprintId: goal?.examBlueprintId ?? null, skillIds: members }),
  ]);

  const weighed = weighGraphForExam({
    areaShares: facts?.areaShares ?? null,
    courseWeights: goal ? readCourseWeights(goal.details) : null,
    graph,
    topicLevels: facts?.topicLevels ?? [],
  });

  const graphSkills = new Map(weighed.skills.map((skill) => [survivorOf(skill.skillId), skill]));

  const importance = new Map(
    skills.map((skill) => {
      const graphSkill = graphSkills.get(skill.skillId);
      const counts = skill.memberSkillIds.flatMap((id) => bank.get(id) ?? []);
      const rated = counts.reduce((sum, entry) => sum + entry.count, 0);

      const difficulty =
        rated > 0
          ? counts.reduce((sum, entry) => sum + entry.sum, 0) / rated
          : getGraphDifficulty({ graph, phase: graphSkill?.phase ?? null });

      return [
        skill.skillId,
        getSkillImportance({ difficulty, weight: graphSkill?.weight ?? 1 }),
      ] as const;
    }),
  );

  return { importance, sectionWeights: facts?.areaShares ?? null };
}
