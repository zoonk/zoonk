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

/** The Library band the skill graph put each skill in (see `PlanBase`). */
async function loadSkillBands(skillIds: string[]): Promise<Map<string, CourseLevel>> {
  const skills = await prisma.skill.findMany({
    select: { id: true, level: true },
    where: { id: { in: skillIds } },
  });

  return new Map(
    skills.flatMap((skill) => (skill.level ? [[skill.id, skill.level] as const] : [])),
  );
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

/**
 * Reads what the planner needs from the Library and the learner model for one goal's graph. A plan
 * the learner made harder also needs the areas they're doing well in, which it starts past.
 */
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
  /** The options the learner picked of their exam's choices (`PlanSettings.examChoices`). */
  examChoices?: readonly ExamChoice[];
  /** Where the learner focuses: their own answers take those skills as known twice. */
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
    // An exam tells its bases by how often it asks topics; other goals, by band (see `PlanBase`).
    isExam ? new Map<string, CourseLevel>() : loadSkillBands(skillIds),
  ]);

  // A test's miss is a gap, and so is a topic the learner was taken to know (or passed over by
  // choice) that practice then missed: its lessons come back first (see `SkillClaim`).
  // What the learner showed they know, as the syllabus says it (see `listKnownSkills`). A skill
  // they passed over by choice has no lessons in the plan either way, so it never waits for time.
  const { answeredWrong, claims, known: knownSkillIds } = evidence;
  const missedSkillIds = listClaimed({ claim: "gap", claims });

  const strongAreas =
    difficultyBias === "harder"
      ? await loadStrongAreas({ graph, lessons, userId })
      : new Set<string>();

  return {
    answeredWrongSkillIds: answeredWrong,
    bands,
    knownSkillIds,
    lessons,
    levelFloor: getLevelFloor(getOwnLevel({ goal })),
    missedSkillIds,
    prerequisites,
    readiness,
    strongAreas,
    ...exam,
  };
}
