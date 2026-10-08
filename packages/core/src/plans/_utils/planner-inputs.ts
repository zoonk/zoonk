import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { toSkillStatus } from "../../learner/_utils/skill-status";
import { loadSkillSurvivors } from "../../learner/_utils/update-learner-skill";
import { type DifficultyBias, type PlanGraph } from "../planner/plan-state";
import { type SkillReadiness } from "../planner/skill-order";
import { loadExamFacts } from "./planner-exam-facts";
import { loadGoalPlannerLessons } from "./planner-lessons";
import { loadStrongAreas } from "./strong-areas";

/**
 * Plans may point at a skill merged into another since; the learner's state and the lessons live
 * on the survivor. Duplicates that merged into one skill keep their first place.
 */
export async function resolveMergedSkills(graph: PlanGraph): Promise<PlanGraph> {
  const survivorOf = await loadSkillSurvivors(graph.skills.map((skill) => skill.skillId));
  const skills = graph.skills.map((skill) => ({ ...skill, skillId: survivorOf(skill.skillId) }));

  return {
    ...graph,
    skills: skills.filter(
      (skill, index) => skills.findIndex((other) => other.skillId === skill.skillId) === index,
    ),
  };
}

async function loadPrerequisites(skillIds: string[]): Promise<Map<string, string[]>> {
  const edges = await prisma.skillPrerequisite.findMany({
    select: { prerequisiteId: true, skillId: true },
    where: { prerequisiteId: { in: skillIds }, skillId: { in: skillIds } },
  });

  return edges.reduce((map, edge) => {
    map.set(edge.skillId, [...(map.get(edge.skillId) ?? []), edge.prerequisiteId]);
    return map;
  }, new Map<string, string[]>());
}

/** For exam priority: each skill's state and how much of it will be remembered on the exam day. */
async function loadReadiness({
  skillIds,
  targetDate,
  userId,
}: {
  skillIds: string[];
  targetDate: Date | null;
  userId: string;
}): Promise<Map<string, SkillReadiness>> {
  if (!targetDate) {
    return new Map();
  }

  const rows = await prisma.learnerSkill.findMany({ where: { skillId: { in: skillIds }, userId } });

  return new Map(
    rows.map((row) => {
      const status = toSkillStatus({ learnerSkill: row, now: targetDate });

      return [
        row.skillId,
        {
          reps: row.reps,
          retrievabilityAtTarget: status.retrievability,
          stability: row.stability,
          state: status.state,
        },
      ];
    }),
  );
}

/** More test answers than this on one goal's skills say nothing new about where its gaps are. */
const MAX_TEST_ANSWERS = 1000;

/**
 * The skills whose last answer in a test (placement, the focus test, a chapter test: bank questions
 * answered outside lessons and sessions) was wrong or "I don't know yet". A don't-know leaves no
 * state in the learner model, so the answers themselves say where the gaps are; a later right
 * answer closes one.
 */
async function loadMissedSkillIds({
  skillIds,
  userId,
}: {
  skillIds: string[];
  userId: string;
}): Promise<Set<string>> {
  const answers = await prisma.attempt.findMany({
    orderBy: { answeredAt: "desc" },
    select: { isCorrect: true, skillId: true },
    take: MAX_TEST_ANSWERS,
    where: {
      itemId: { not: null },
      skillId: { in: skillIds },
      stepId: null,
      studySessionId: null,
      userId,
    },
  });

  const last = answers.reduce(
    (latest, answer) =>
      answer.skillId && !latest.has(answer.skillId)
        ? latest.set(answer.skillId, answer.isCorrect)
        : latest,
    new Map<string, boolean>(),
  );

  return new Set([...last].filter(([, isCorrect]) => !isCorrect).map(([skillId]) => skillId));
}

/**
 * Reads what the planner needs from the Library and the learner model for one goal's graph. A plan
 * the learner made harder also needs the areas they're doing well in, which it starts past.
 */
export async function loadPlannerInputs({
  difficultyBias,
  goal,
  graph,
  targetDate,
  userId,
}: {
  difficultyBias: DifficultyBias;
  goal: Pick<Goal, "details" | "examBlueprintId" | "kind" | "primaryCourseId">;
  graph: PlanGraph;
  targetDate: Date | null;
  userId: string;
}) {
  const skillIds = graph.skills.map((skill) => skill.skillId);
  const isExam = goal.kind === "exam";

  const [lessons, prerequisites, readiness, exam, missedSkillIds] = await Promise.all([
    loadGoalPlannerLessons({ goal, graph, userId }),
    loadPrerequisites(skillIds),
    loadReadiness({ skillIds, targetDate: isExam ? targetDate : null, userId }),
    loadExamFacts({ goal, graph }),
    isExam ? loadMissedSkillIds({ skillIds, userId }) : new Set<string>(),
  ]);

  const strongAreas =
    difficultyBias === "harder"
      ? await loadStrongAreas({ graph, lessons, userId })
      : new Set<string>();

  return { lessons, missedSkillIds, prerequisites, readiness, strongAreas, ...exam };
}
