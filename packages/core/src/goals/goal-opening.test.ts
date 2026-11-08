import { type Course, type Skill, prisma } from "@zoonk/db";
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
import { type GoalOpeningSkill } from "../library/curriculum/opening-graph";
import { findOpeningLesson, readSavedGoalOpening, saveGoalOpening } from "./goal-opening";

function openingFor({ course, skill }: { course: Course; skill: Skill }): GoalOpeningSkill {
  return {
    course: { id: course.id, key: "chosen-course", title: course.title },
    skill: {
      area: "Chosen area",
      description: skill.description,
      estimatedLessons: 3,
      id: skill.id,
      key: "chosen-skill",
      level: "beginner",
      name: skill.name,
    },
  };
}

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

    const [goal, first, second, firstCourse, secondCourse, firstSkill, secondSkill] =
      await Promise.all([
        goalFixture({ userId: user.id }),
        libraryLessonFixture(),
        libraryLessonFixture(),
        courseFixture(),
        courseFixture(),
        skillFixture(),
        skillFixture(),
      ]);

    const firstOpening = openingFor({ course: firstCourse, skill: firstSkill });
    const secondOpening = openingFor({ course: secondCourse, skill: secondSkill });

    const saved = await Promise.all([
      saveGoalOpening({ goalId: goal.id, lessonId: first.id, opening: firstOpening }),
      saveGoalOpening({ goalId: goal.id, lessonId: second.id, opening: secondOpening }),
    ]);

    const [kept] = saved;

    expect([first.id, second.id]).toContain(kept?.id);
    expect(saved).toStrictEqual([kept, kept]);

    await expect(
      saveGoalOpening({ goalId: goal.id, lessonId: second.id, opening: secondOpening }),
    ).resolves.toStrictEqual(kept);

    await expect(readSavedGoalOpening(goal.id)).resolves.toStrictEqual({
      lesson: kept,
      skill: kept?.id === first.id ? firstOpening : secondOpening,
    });
  });
});

describe(readSavedGoalOpening, () => {
  it("retries from the opening skill even when a reused chapter has an older skill tag", async () => {
    const user = await userFixture();

    const [course, chapter, olderSkill, openingSkill, goal] = await Promise.all([
      courseFixture(),
      libraryChapterFixture({ outlineStatus: "completed" }),
      skillFixture({ name: "An older chapter skill" }),
      skillFixture({ name: "The chosen opening skill" }),
      goalFixture({ userId: user.id }),
    ]);

    const lesson = await libraryLessonFixture({ homeChapterId: chapter.id });

    await Promise.all([
      courseChapterFixture({ chapterId: chapter.id, courseId: course.id }),
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
      prisma.chapterSkill.create({
        data: { chapterId: chapter.id, createdAt: new Date("2026-11-01"), skillId: olderSkill.id },
      }),
      prisma.chapterSkill.create({
        data: {
          chapterId: chapter.id,
          createdAt: new Date("2026-11-02"),
          skillId: openingSkill.id,
        },
      }),
    ]);

    const chosen = await findOpeningLesson({
      courseId: course.id,
      skillId: openingSkill.id,
      userId: user.id,
    });

    expect(chosen).toBe(lesson.id);
    const opening = openingFor({ course, skill: openingSkill });
    await saveGoalOpening({ goalId: goal.id, lessonId: lesson.id, opening });
    const resumed = await readSavedGoalOpening(goal.id);
    expect(resumed?.skill).toStrictEqual(opening);
  });

  it("retries from the selected course when its first lesson is reused from another home chapter", async () => {
    const user = await userFixture();

    const [course, homeCourse, chapter, home, skill, homeSkill, goal] = await Promise.all([
      courseFixture(),
      courseFixture(),
      libraryChapterFixture({ outlineStatus: "completed" }),
      libraryChapterFixture({ outlineStatus: "completed" }),
      skillFixture(),
      skillFixture(),
      goalFixture({ userId: user.id }),
    ]);

    const lesson = await libraryLessonFixture({ homeChapterId: home.id });

    await Promise.all([
      courseChapterFixture({ chapterId: chapter.id, courseId: course.id }),
      courseChapterFixture({ chapterId: home.id, courseId: homeCourse.id }),
      prisma.chapterSkill.create({ data: { chapterId: chapter.id, skillId: skill.id } }),
      prisma.chapterSkill.create({ data: { chapterId: home.id, skillId: homeSkill.id } }),
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
      chapterLessonFixture({ chapterId: home.id, lessonId: lesson.id, position: 0 }),
    ]);

    const chosen = await findOpeningLesson({
      courseId: course.id,
      skillId: skill.id,
      userId: user.id,
    });

    expect(chosen).toBe(lesson.id);
    const opening = openingFor({ course, skill });
    await saveGoalOpening({ goalId: goal.id, lessonId: lesson.id, opening });
    const resumed = await readSavedGoalOpening(goal.id);
    expect(resumed?.skill).toStrictEqual(opening);
  });
});
