import "server-only";
import { type Attempt, prisma } from "@zoonk/db";
import { loadSkillSurvivors } from "./update-learner-skill";

/**
 * The plan skills the learner's study plans hold each lesson for. A plan item with a skill and a
 * lesson teaches the plan's skill through that lesson, whose own skills are usually finer (the
 * relation `memberSkillIds` reads in `loadGoalPlan`): sessions review and practice the plan's
 * skill, with the bank's questions on it, so a finished lesson comes back through it. A quick
 * explanation's plan has no sessions to bring anything back.
 */
export async function loadLessonPlanSkillIds({
  lessonIds,
  userId,
}: {
  lessonIds: readonly string[];
  userId: string;
}): Promise<Map<string, string[]>> {
  if (lessonIds.length === 0) {
    return new Map();
  }

  const items = await prisma.planItem.findMany({
    distinct: ["lessonId", "skillId"],
    select: { lessonId: true, skillId: true },
    where: {
      lessonId: { in: [...lessonIds] },
      plan: { goal: { kind: { not: "explain" }, userId } },
      skillId: { not: null },
    },
  });

  const survivorOf = await loadSkillSurvivors(items.flatMap((item) => item.skillId ?? []));

  return new Map(
    [...Map.groupBy(items, (item) => item.lessonId ?? "")].map(([lessonId, rows]) => [
      lessonId,
      [...new Set(rows.flatMap((row) => (row.skillId ? [survivorOf(row.skillId)] : [])))],
    ]),
  );
}

/**
 * The skills a lesson comes back with in reviews and practice: the plan skills the learner's plans
 * hold it for (see `loadLessonPlanSkillIds`), else the skills its answers land on.
 */
export async function loadLessonReviewSkillIds({
  lessonId,
  ownSkillIds,
  userId,
}: {
  lessonId: string;
  ownSkillIds: readonly string[];
  userId: string;
}): Promise<string[]> {
  const planSkillIds = await loadLessonPlanSkillIds({ lessonIds: [lessonId], userId });
  const held = planSkillIds.get(lessonId) ?? [];

  return held.length > 0 ? held : [...ownSkillIds];
}

/**
 * The skills answers come back with in reviews and practice: a lesson screen's answer comes back
 * with the plan skills its lesson is held for (see `loadLessonPlanSkillIds`), any other answer and
 * a screen of a lesson no plan holds for a skill with the skill it landed on.
 */
export async function loadAnswersReviewSkillIds({
  answers,
  userId,
}: {
  answers: readonly Pick<Attempt, "skillId" | "stepId">[];
  userId: string;
}): Promise<string[]> {
  const stepIds = [...new Set(answers.flatMap((answer) => answer.stepId ?? []))];

  const steps =
    stepIds.length > 0
      ? await prisma.step.findMany({
          select: { id: true, lessonId: true },
          where: { id: { in: stepIds } },
        })
      : [];

  const lessonOf = new Map(steps.map((step) => [step.id, step.lessonId]));

  const planSkillIds = await loadLessonPlanSkillIds({
    lessonIds: [...new Set(steps.map((step) => step.lessonId))],
    userId,
  });

  const comesBackWith = ({ skillId, stepId }: Pick<Attempt, "skillId" | "stepId">) => {
    const held = planSkillIds.get(lessonOf.get(stepId ?? "") ?? "") ?? [];

    if (held.length > 0) {
      return held;
    }

    return skillId ? [skillId] : [];
  };

  return [...new Set(answers.flatMap((answer) => comesBackWith(answer)))];
}
