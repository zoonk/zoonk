import { type Skill } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { type PlanGraph } from "../planner/plan-state";

type SkillSpec = {
  area?: string;
  /** Library lessons to create for the skill; 0 leaves it to a placeholder of `size` lessons. */
  lessons: number;
  phase?: number;
  size?: number;
  weight?: number;
};

/**
 * A Library chapter per phase with lessons for each skill, and the goal's graph pointing at them:
 * the shape the goal-driven workflow hands the planner.
 */
export async function planLibraryFixture({
  phases = ["Basics"],
  skills,
}: {
  phases?: string[];
  skills: SkillSpec[];
}) {
  // Plans teach a title once, so two libraries in one test need lesson titles of their own.
  const [libraryId] = crypto.randomUUID().split("-");

  const chapters = await Promise.all(
    phases.map((name, index) => libraryChapterFixture({ title: `${name} chapter ${index + 1}` })),
  );

  const created: Skill[] = await Promise.all(
    skills.map((_, index) => skillFixture({ name: `Planned skill ${index + 1}` })),
  );

  const lessons = await Promise.all(
    skills.flatMap((spec, skillIndex) =>
      Array.from({ length: spec.lessons }, async (_, lessonIndex) => {
        const chapter = chapters[spec.phase ?? 0];

        const lesson = await libraryLessonFixture({
          estimatedMinutes: 3,
          homeChapterId: chapter?.id ?? null,
          title: `Lesson ${skillIndex + 1}.${lessonIndex + 1} ${libraryId}`,
        });

        await Promise.all([
          chapter
            ? chapterLessonFixture({
                chapterId: chapter.id,
                lessonId: lesson.id,
                position: skillIndex * 100 + lessonIndex,
              })
            : null,
          lessonSkillFixture({ lessonId: lesson.id, skillId: created[skillIndex]?.id ?? "" }),
        ]);

        return lesson;
      }),
    ),
  );

  const graph: PlanGraph = {
    phases: phases.map((name) => ({ milestone: `Can do ${name}`, name })),
    skills: skills.map((spec, index) => ({
      area: spec.area ?? null,
      lessons: spec.size ?? Math.max(1, spec.lessons),
      name: created[index]?.name ?? "",
      phase: spec.phase ?? 0,
      skillId: created[index]?.id ?? "",
      weight: spec.weight ?? null,
    })),
  };

  return { chapters, graph, lessons, skills: created };
}

/** A goal with the empty plan goal creation makes, waiting for the planner. */
export async function unplannedGoalFixture({
  settings = {},
  ...attrs
}: Parameters<typeof goalFixture>[0] & { settings?: object }) {
  const goal = await goalFixture(attrs);
  const plan = await planFixture({ goalId: goal.id, phases: [], settings });

  return { goal, plan };
}
