import { randomUUID } from "node:crypto";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import {
  choiceItemContent,
  itemFixture,
  skillFixture,
  skillPrerequisiteFixture,
} from "@zoonk/testing/fixtures/skills";

const SHORT_ID_LENGTH = 8;
const SKILLS_PER_PHASE = [3, 2];

/** Every question up to placement is behind the learner: only placement and the plan are left. */
export const ANSWERED = ["purpose", "targetDate", "level", "schedule", "age", "memory", "buddy"];

/**
 * A goal whose skill map is already written, the way the goal workflow leaves it, with every
 * question up to placement answered: placement (two questions per skill) and the plan are left.
 */
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

/**
 * Writes an existing goal's skill map as the goal workflow does: its plan, skills and, unless
 * `items` is false, two placement questions per skill. With `placementPrepared`, the run recorded
 * that placement's questions were written, so none still coming means none could be.
 */
export async function mapGoalSkills({
  goalId,
  items = true,
  placementPrepared = false,
}: {
  goalId: string;
  items?: boolean;
  placementPrepared?: boolean;
}) {
  const id = randomUUID().slice(0, SHORT_ID_LENGTH);

  const plan = await planFixture({
    goalId,
    phases: SKILLS_PER_PHASE.map((_, index) => ({
      name: `Stage ${index + 1} ${id}`,
      summary: "Test",
    })),
    placementPreparedAt: placementPrepared ? new Date() : null,
  });

  const total = SKILLS_PER_PHASE.reduce((sum, count) => sum + count, 0);

  const skills = await Promise.all(
    Array.from({ length: total }, (_, index) => skillFixture({ name: `Skill ${index + 1} ${id}` })),
  );

  const phaseOf = SKILLS_PER_PHASE.flatMap((count, phase) =>
    Array.from({ length: count }, () => phase),
  );

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
    ...(items
      ? skills.flatMap((skill, index) =>
          [1, 2].map((copy) =>
            itemFixture({
              content: choiceItemContent(`Question ${index + 1}.${copy} ${id}?`),
              skillId: skill.id,
            }),
          ),
        )
      : []),
  ]);
}
