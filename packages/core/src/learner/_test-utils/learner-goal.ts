import { type Item, type Skill } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  choiceItemContent,
  itemFixture,
  skillFixture,
  skillPrerequisiteFixture,
} from "@zoonk/testing/fixtures/skills";

/**
 * A goal whose plan has one chapter per phase and one plan item per skill, each skill building on
 * the one before, and `itemsPerSkill` multiple-choice questions per skill.
 */
export async function learnerGoalFixture({
  itemsPerSkill = 2,
  phases,
  userId,
}: {
  itemsPerSkill?: number;
  /** Skills per phase, such as `[3, 2]`. */
  phases: number[];
  userId: string;
}) {
  // Its sessions don't open with first-week placement questions unless a test asks; aging the goal
  // instead would end a free exam trial.
  const goal = await goalFixture({ details: { placementDeclined: true }, userId });

  const plan = await planFixture({
    goalId: goal.id,
    phases: phases.map((_, index) => ({ name: `Phase ${index + 1}` })),
  });

  const chapters = await Promise.all(
    phases.map((_, index) => libraryChapterFixture({ title: `Chapter ${index + 1}` })),
  );

  const total = phases.reduce((sum, count) => sum + count, 0);

  const skills: Skill[] = await Promise.all(
    Array.from({ length: total }, (_, index) => skillFixture({ name: `Skill ${index + 1}` })),
  );

  const phaseOf = phases.flatMap((count, phase) => Array.from({ length: count }, () => phase));

  await Promise.all(
    skills
      .slice(1)
      .map((skill, index) =>
        skillPrerequisiteFixture({ prerequisiteId: skills[index]?.id ?? "", skillId: skill.id }),
      ),
  );

  const planItems = await Promise.all(
    skills.map((skill, position) => {
      const phase = phaseOf[position] ?? 0;

      return planItemFixture({
        chapterId: chapters[phase]?.id ?? null,
        phase,
        planId: plan.id,
        position,
        skillId: skill.id,
      });
    }),
  );

  const items: Item[] = await Promise.all(
    skills.flatMap((skill) =>
      Array.from({ length: itemsPerSkill }, () =>
        itemFixture({ content: choiceItemContent(), skillId: skill.id }),
      ),
    ),
  );

  return { chapters, goal, items, plan, planItems, skills };
}
