import "server-only";
import { type Attempt, prisma } from "@zoonk/db";
import { loadSkillSurvivors } from "./update-learner-skill";

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

/** Uses plan skills when a lesson belongs to a plan, otherwise its own skills. */
export async function loadLessonReviewSkillIds({
  lessonIds,
  userId,
}: {
  lessonIds: readonly string[];
  userId: string;
}): Promise<Map<string, string[]>> {
  if (lessonIds.length === 0) {
    return new Map();
  }

  const [ownSkills, planSkillIds] = await Promise.all([
    prisma.lessonSkill.findMany({
      select: { lessonId: true, skillId: true },
      where: { lessonId: { in: [...lessonIds] } },
    }),
    loadLessonPlanSkillIds({ lessonIds, userId }),
  ]);

  const ownSkillIds = Map.groupBy(ownSkills, (row) => row.lessonId);

  return new Map(
    lessonIds.map((lessonId) => {
      const held = planSkillIds.get(lessonId) ?? [];
      const own = ownSkillIds.get(lessonId) ?? [];
      return [lessonId, held.length > 0 ? held : own.map((row) => row.skillId)];
    }),
  );
}

/** Lesson answers map to the plan's skill when available; other answers keep their recorded skill. */
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
