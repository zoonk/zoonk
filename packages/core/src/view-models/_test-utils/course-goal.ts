import { type PlanItemStatus } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { skillFixture, skillPrerequisiteFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { mockSession } from "../../_test-utils/mock-session";

const LESSONS_PER_CHAPTER = 2;

/** Each lesson a minute longer than the one before, so tests can tell them apart. */
const FIRST_LESSON_MINUTES = 5;

/**
 * A learn goal built from a public course's Overview: two chapters of two one-skill lessons, one
 * per phase, each skill building on the one before. The course also has a Beginner chapter the
 * plan doesn't use. `statuses` sets each lesson's plan item, in order.
 */
export async function courseGoalFixture({
  details = {},
  statuses = ["todo", "todo", "todo", "todo"],
  userId,
}: {
  details?: Record<string, string>;
  statuses?: PlanItemStatus[];
  userId: string;
}) {
  const organization = await organizationFixture();

  const course = await courseFixture({
    organizationId: organization.id,
    title: "Quantum physics",
    visibility: "public",
  });

  const [first, second, beginner] = await Promise.all([
    libraryChapterFixture({ level: "overview", title: "The very small world" }),
    libraryChapterFixture({ level: "overview", title: "Inside the atom" }),
    libraryChapterFixture({ level: "beginner", title: "Waves" }),
  ]);

  const chapters = [first, second];

  await Promise.all([
    courseChapterFixture({
      chapterId: first.id,
      courseId: course.id,
      level: "overview",
      position: 0,
    }),
    courseChapterFixture({
      chapterId: second.id,
      courseId: course.id,
      level: "overview",
      position: 1,
    }),
    courseChapterFixture({
      chapterId: beginner.id,
      courseId: course.id,
      level: "beginner",
      position: 0,
    }),
  ]);

  const skills = await Promise.all(
    ["Atom", "Nucleus", "Orbital", "Energy levels"].map((name) =>
      skillFixture({ description: `${name} in one sentence`, name }),
    ),
  );

  const lessons = await Promise.all(
    skills.map((skill, index) =>
      libraryLessonFixture({
        estimatedMinutes: FIRST_LESSON_MINUTES + index,
        title: `Lesson about ${skill.name}`,
      }),
    ),
  );

  await Promise.all([
    ...skills
      .slice(1)
      .map((skill, index) =>
        skillPrerequisiteFixture({ prerequisiteId: skills[index]?.id ?? "", skillId: skill.id }),
      ),
    ...lessons.flatMap((lesson, index) => [
      lessonSkillFixture({ lessonId: lesson.id, skillId: skills[index]?.id ?? "" }),
      chapterLessonFixture({
        chapterId: chapters[Math.floor(index / LESSONS_PER_CHAPTER)]?.id ?? "",
        lessonId: lesson.id,
        position: index % LESSONS_PER_CHAPTER,
      }),
    ]),
  ]);

  const goal = await goalFixture({ details, primaryCourseId: course.id, userId });

  const plan = await planFixture({
    goalId: goal.id,
    phases: [{ name: "The very small" }, { name: "The atom" }],
  });

  const items = await Promise.all(
    lessons.map((lesson, position) => {
      const phase = Math.floor(position / LESSONS_PER_CHAPTER);

      return planItemFixture({
        chapterId: chapters[phase]?.id ?? null,
        lessonId: lesson.id,
        phase,
        planId: plan.id,
        position,
        status: statuses[position] ?? "todo",
        titleSnapshot: lesson.title,
      });
    }),
  );

  return { beginner, chapters, course, goal, items, lessons, organization, plan, skills };
}

/** A signed-in learner whose active goal is the course goal above. */
export async function signedInCourseGoal(
  options: Omit<Parameters<typeof courseGoalFixture>[0], "userId"> = {},
) {
  const user = await userFixture();
  const fixture = await courseGoalFixture({ ...options, userId: user.id });
  await learningProfileFixture({ activeGoalId: fixture.goal.id, userId: user.id });
  mockSession(user.id);
  return { ...fixture, user };
}
