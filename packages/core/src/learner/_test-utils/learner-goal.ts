import { type Item, type Skill } from "@zoonk/db";
import {
  goalFixture,
  planFixture,
  planItemFixture,
  plannedSkills,
} from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import {
  choiceItemContent,
  itemFixture,
  skillFixture,
  skillPrerequisiteFixture,
} from "@zoonk/testing/fixtures/skills";

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
  // Decline placement rather than aging the goal, which would also end a free exam trial.
  const goal = await goalFixture({ details: { placementDeclined: true }, userId });

  const chapters = await Promise.all(
    phases.map((_, index) => libraryChapterFixture({ title: `Chapter ${index + 1}` })),
  );

  const total = phases.reduce((sum, count) => sum + count, 0);

  const skills: Skill[] = await Promise.all(
    Array.from({ length: total }, (_, index) => skillFixture({ name: `Skill ${index + 1}` })),
  );

  const phaseOf = phases.flatMap((count, phase) => Array.from({ length: count }, () => phase));

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      skills: plannedSkills(skills.map((skill, index) => ({ ...skill, phase: phaseOf[index] }))),
    },
    phases: phases.map((_, index) => ({ name: `Phase ${index + 1}` })),
  });

  await Promise.all(
    skills
      .slice(1)
      .map((skill, index) =>
        skillPrerequisiteFixture({ prerequisiteId: skills[index]?.id ?? "", skillId: skill.id }),
      ),
  );

  const planItems = await Promise.all(
    skills.map(async (skill, position) => {
      const phase = phaseOf[position] ?? 0;
      const chapterId = chapters[phase]?.id ?? "";
      const lesson = await libraryLessonFixture({ homeChapterId: chapterId, title: skill.name });

      await Promise.all([
        chapterLessonFixture({ chapterId, lessonId: lesson.id, position }),
        lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
      ]);

      return planItemFixture({
        chapterId,
        lessonId: lesson.id,
        phase,
        planId: plan.id,
        position,
        skillId: skill.id,
        titleSnapshot: lesson.title,
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
