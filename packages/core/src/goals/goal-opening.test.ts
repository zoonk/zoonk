import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import {
  chapterSkillFixture,
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { findOpeningLesson, saveGoalOpening } from "./goal-opening";

async function taughtCourse() {
  const [course, skill, chapter, later, first, second] = await Promise.all([
    courseFixture(),
    skillFixture(),
    libraryChapterFixture({ outlineStatus: "completed" }),
    libraryChapterFixture({ outlineStatus: "completed" }),
    libraryLessonFixture(),
    libraryLessonFixture(),
  ]);

  await Promise.all([
    courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position: 0 }),
    courseChapterFixture({ chapterId: later.id, courseId: course.id, position: 1 }),
    chapterSkillFixture({ chapterId: chapter.id, skillId: skill.id }),
    chapterSkillFixture({ chapterId: later.id, skillId: skill.id }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: second.id, position: 1 }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: first.id, position: 0 }),
  ]);

  return { course, first, skill };
}

describe(findOpeningLesson, () => {
  it("opens on the first lesson of the course's first chapter that teaches the skill", async () => {
    const [{ course, first, skill }, user] = await Promise.all([taughtCourse(), userFixture()]);

    await expect(
      findOpeningLesson({ courseId: course.id, skillId: skill.id, userId: user.id }),
    ).resolves.toBe(first.id);
  });

  it("writes a new chapter when the course doesn't teach the skill yet", async () => {
    const [{ course }, other, user] = await Promise.all([
      taughtCourse(),
      skillFixture(),
      userFixture(),
    ]);

    await expect(
      findOpeningLesson({ courseId: course.id, skillId: other.id, userId: user.id }),
    ).resolves.toBeNull();
  });
});

describe(saveGoalOpening, () => {
  it("keeps the first lesson saved when runs save at once", async () => {
    const user = await userFixture();

    const [goal, first, second] = await Promise.all([
      goalFixture({ userId: user.id }),
      libraryLessonFixture(),
      libraryLessonFixture(),
    ]);

    const saved = await Promise.all([
      saveGoalOpening({ goalId: goal.id, lessonId: first.id }),
      saveGoalOpening({ goalId: goal.id, lessonId: second.id }),
    ]);

    const [kept] = saved;

    expect([first.id, second.id]).toContain(kept?.id);
    expect(saved).toStrictEqual([kept, kept]);

    await expect(saveGoalOpening({ goalId: goal.id, lessonId: second.id })).resolves.toStrictEqual(
      kept,
    );
  });
});
