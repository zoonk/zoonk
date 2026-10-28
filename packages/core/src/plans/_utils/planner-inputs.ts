import "server-only";
import { type CourseLevel, type Goal, prisma } from "@zoonk/db";
import { type ExamChoice } from "../../exams/choices/exam-choices";
import { loadSkillEvidence } from "../../learner/_utils/load-skill-claims";
import { listClaimed } from "../../learner/_utils/skill-claims";
import { toSkillStatus } from "../../learner/_utils/skill-status";
import { loadSkillSurvivors } from "../../learner/_utils/update-learner-skill";
import { getOwnLevel } from "../../learner/placement/placement-contract";
import { loadSkillPrerequisites } from "../../library/skills/skill-prerequisites";
import { listFocusedSkillIds } from "../planner/focus-targets";
import { type DifficultyBias, type PlanGraph, type PlanSettings } from "../planner/plan-state";
import { type SkillReadiness } from "../planner/skill-order";
import { getLevelFloor } from "./level-bands";
import { loadExamFacts } from "./planner-exam-facts";
import { loadGoalPlannerLessons } from "./planner-lessons";
import { loadStrongAreas } from "./strong-areas";

export async function resolveMergedSkills(graph: PlanGraph): Promise<PlanGraph> {
  const survivorOf = await loadSkillSurvivors(graph.skills.map((skill) => skill.skillId));
  const skills = graph.skills.map((skill) => ({ ...skill, skillId: survivorOf(skill.skillId) }));

  return {
    ...graph,
    skills: skills
      .filter(
        (skill, index) => skills.findIndex((other) => other.skillId === skill.skillId) === index,
      )
      .map(({ outlined: _outlined, ...skill }) => ({
        ...skill,
        ...(skills
          .filter((other) => other.skillId === skill.skillId)
          .every((other) => other.outlined === true)
          ? { outlined: true }
          : {}),
      })),
  };
}

async function loadSkillBands(skillIds: string[]): Promise<Map<string, CourseLevel>> {
  const skills = await prisma.skill.findMany({
    orderBy: { id: "asc" },
    select: { id: true, level: true },
    where: { id: { in: skillIds } },
  });

  return new Map(
    skills.flatMap((skill) => (skill.level ? [[skill.id, skill.level] as const] : [])),
  );
}

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

  const rows = await prisma.learnerSkill.findMany({
    orderBy: { skillId: "asc" },
    where: { skillId: { in: skillIds }, userId },
  });

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

export async function loadPlannerInputs({
  difficultyBias,
  examChoices = [],
  focus = { focusAreas: [], focusParts: [] },
  goal,
  graph,
  targetDate,
  userId,
}: {
  difficultyBias: DifficultyBias;
  examChoices?: readonly ExamChoice[];
  focus?: Pick<PlanSettings, "focusAreas" | "focusParts">;
  goal: Pick<Goal, "details" | "examBlueprintId" | "id" | "kind" | "primaryCourseId">;
  graph: PlanGraph;
  targetDate: Date | null;
  userId: string;
}) {
  const skillIds = graph.skills.map((skill) => skill.skillId);
  const isExam = goal.kind === "exam";

  const focused = listFocusedSkillIds({ graph, settings: focus });

  const [lessons, prerequisites, readiness, exam, evidence, bands] = await Promise.all([
    loadGoalPlannerLessons({ goal, graph, userId }),
    loadSkillPrerequisites(skillIds),
    loadReadiness({ skillIds, targetDate: isExam ? targetDate : null, userId }),
    loadExamFacts({ choices: examChoices, goal, graph }),
    loadSkillEvidence({
      focused: (skillId) => focused.has(skillId),
      goalId: goal.id,
      skillIds,
      userId,
    }),
    isExam ? new Map<string, CourseLevel>() : loadSkillBands(skillIds),
  ]);

  const { answeredWrong, claims, known: knownSkillIds } = evidence;
  const missedSkillIds = listClaimed({ claim: "gap", claims });

  const strongAreas =
    difficultyBias === "harder"
      ? await loadStrongAreas({ graph, lessons, userId })
      : new Set<string>();

  return {
    answeredWrongSkillIds: new Set([...answeredWrong].toSorted()),
    bands,
    knownSkillIds: new Set([...knownSkillIds].toSorted()),
    lessons,
    levelFloor: getLevelFloor(getOwnLevel({ goal })),
    missedSkillIds: new Set([...missedSkillIds].toSorted()),
    prerequisites: new Map([...prerequisites].toSorted(([a], [b]) => a.localeCompare(b))),
    readiness,
    strongAreas: new Set([...strongAreas].toSorted()),
    ...exam,
  };
}
