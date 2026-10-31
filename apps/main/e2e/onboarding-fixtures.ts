import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import {
  goalFixture,
  planFixture,
  planItemFixture,
  plannedSkills,
} from "@zoonk/testing/fixtures/goals";
import {
  choiceItemContent,
  itemFixture,
  skillFixture,
  skillPrerequisiteFixture,
} from "@zoonk/testing/fixtures/skills";

const SHORT_ID_LENGTH = 8;
const SKILLS_PER_PHASE = [3, 2];

export const ANSWERED = ["purpose", "targetDate", "level", "schedule", "buddy"];

export async function createMappedGoal(userId: string) {
  const id = randomUUID().slice(0, SHORT_ID_LENGTH);

  const goal = await goalFixture({
    dailyMinutes: 30,
    details: { answered: ANSWERED, subject: "algebra" },
    prompt: `learn algebra ${id}`,
    title: `Learn algebra ${id}`,
    userId,
  });

  await mapGoalSkills({ goalId: goal.id });
  return goal;
}

/** Replaces the empty plan a goal the app started has, as its build would. */
export async function mapGoalSkills({ goalId }: { goalId: string }) {
  const id = randomUUID().slice(0, SHORT_ID_LENGTH);
  await prisma.plan.deleteMany({ where: { goalId } });

  const total = SKILLS_PER_PHASE.reduce((sum, count) => sum + count, 0);

  const skills = await Promise.all(
    Array.from({ length: total }, (_, index) => skillFixture({ name: `Skill ${index + 1} ${id}` })),
  );

  const phaseOf = SKILLS_PER_PHASE.flatMap((count, phase) =>
    Array.from({ length: count }, () => phase),
  );

  const plan = await planFixture({
    goalId,
    graph: {
      skills: plannedSkills(skills.map((skill, index) => ({ ...skill, phase: phaseOf[index] }))),
    },
    phases: SKILLS_PER_PHASE.map((_, index) => ({
      name: `Stage ${index + 1} ${id}`,
      summary: "Test",
    })),
  });

  await Promise.all([
    ...skills
      .slice(1)
      .map((skill, index) =>
        skillPrerequisiteFixture({ prerequisiteId: skills[index]?.id ?? "", skillId: skill.id }),
      ),
    ...skills.map((skill, position) =>
      planItemFixture({
        kind: "lesson",
        phase: phaseOf[position] ?? 0,
        planId: plan.id,
        position,
        skillId: skill.id,
        titleSnapshot: `Lesson ${position + 1}`,
      }),
    ),
    ...skills.flatMap((skill, index) =>
      [1, 2].map((copy) =>
        itemFixture({
          content: choiceItemContent(`Question ${index + 1}.${copy} ${id}?`),
          skillId: skill.id,
        }),
      ),
    ),
  ]);
}
