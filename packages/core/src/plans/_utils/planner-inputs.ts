import "server-only";
import { type CourseLevel, type Goal, prisma } from "@zoonk/db";
import { type ExamPicks } from "../../exams/choices/exam-choices";
import { loadCurrentLanguageLevel } from "../../language/levels/current-language-level";
import { loadSkillEvidence } from "../../learner/_utils/load-skill-claims";
import { listClaimed } from "../../learner/_utils/skill-claims";
import { toSkillStatus } from "../../learner/_utils/skill-status";
import { loadSkillSurvivors } from "../../learner/_utils/update-learner-skill";
import { getOwnLevel } from "../../learner/placement/placement-contract";
import { loadSkillPrerequisites } from "../../library/skills/skill-prerequisites";
import { type DifficultyBias, type PlanGraph, type PlanSettings } from "../planner/plan-state";
import { type MockMiss, type SkillReadiness } from "../planner/skill-order";
import { getLevelFloor } from "./level-bands";
import { loadPlanMockMisses } from "./mock-misses";
import { loadExamFacts } from "./planner-exam-facts";
import { loadGoalPlannerLessons } from "./planner-lessons";
import { loadPlanWriting } from "./planner-writing";
import { loadStrongAreas } from "./strong-areas";
import { findWrittenStartLessonId } from "./written-start";

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
  examPicks,
  goal,
  graph,
  mockReplan,
  now,
  skippedAreas,
  targetDate,
  userId,
}: {
  difficultyBias: DifficultyBias;
  examPicks?: ExamPicks;
  goal: Pick<
    Goal,
    | "details"
    | "examBlueprintId"
    | "id"
    | "kind"
    | "planRevealedAt"
    | "primaryCourseId"
    | "targetLanguage"
  >;
  graph: PlanGraph;
  mockReplan: PlanSettings["mockReplan"];
  now: Date;
  skippedAreas: readonly string[];
  targetDate: Date | null;
  userId: string;
}) {
  const skillIds = graph.skills.map((skill) => skill.skillId);
  const isExam = goal.kind === "exam";

  const examFactsRead = Promise.resolve(
    loadExamFacts({
      goal,
      graph: { ...graph, skills: graph.skills.filter((skill) => !skill.extra) },
      picks: examPicks,
    }),
  );

  const [
    lessons,
    prerequisites,
    readiness,
    exam,
    evidence,
    bands,
    startLessonId,
    currentLanguageLevel,
    mockMisses,
  ] = await Promise.all([
    loadGoalPlannerLessons({ goal, graph, userId }),
    loadSkillPrerequisites(skillIds),
    loadReadiness({ skillIds, targetDate: isExam ? targetDate : null, userId }),
    examFactsRead,
    examFactsRead.then(({ writtenSkillIds }) =>
      loadSkillEvidence({
        goalId: goal.id,
        skillIds,
        userId,
        writingFact: { examBlueprintId: goal.examBlueprintId, skillIds: new Set(writtenSkillIds) },
      }),
    ),
    isExam ? new Map<string, CourseLevel>() : loadSkillBands(skillIds),
    findWrittenStartLessonId(goal),
    loadCurrentLanguageLevel({ ...goal, userId }),
    isExam ? loadPlanMockMisses({ goalId: goal.id, mockReplan, now }) : new Map<string, MockMiss>(),
  ]);

  const { writingNotice, writtenSkillIds, ...examFacts } = exam;

  const writing =
    writingNotice && goal.examBlueprintId
      ? await loadPlanWriting({
          examBlueprintId: goal.examBlueprintId,
          graph,
          skillIds: new Set(writtenSkillIds),
          skippedAreas,
          userId,
          ...writingNotice,
        })
      : undefined;

  const { answeredWrong, claims, known: knownSkillIds } = evidence;
  const missedSkillIds = listClaimed({ claim: "gap", claims });

  const unprovenWrittenSkillIds = (writtenSkillIds ?? []).filter(
    (id) => claims.get(id) !== "confirmed" && claims.get(id) !== "toConfirm",
  );

  const strongAreas =
    difficultyBias === "harder"
      ? await loadStrongAreas({ graph, lessons, userId })
      : new Set<string>();

  return {
    answeredWrongSkillIds: new Set([...answeredWrong].toSorted()),
    bands,
    currentLanguageLevel,
    knownSkillIds: new Set([...knownSkillIds].toSorted()),
    lessons,
    levelFloor: getLevelFloor(
      getOwnLevel({
        goal: currentLanguageLevel ? { details: { level: currentLanguageLevel } } : goal,
      }),
    ),
    missedSkillIds: new Set([...missedSkillIds].toSorted()),
    // Absent rather than empty, so a plan no mock reorders keeps the inputs key it was saved with.
    ...(mockMisses.size > 0 && { mockMisses }),
    prerequisites: new Map([...prerequisites].toSorted(([a], [b]) => a.localeCompare(b))),
    readiness,
    startLessonId,
    strongAreas: new Set([...strongAreas].toSorted()),
    unprovenWrittenSkillIds,
    writtenSkillIds,
    ...examFacts,
    ...(writing && { writing }),
  };
}
