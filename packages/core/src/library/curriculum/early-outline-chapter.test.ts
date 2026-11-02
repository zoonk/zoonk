import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import {
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
import { findEarlyOutlineChapter, relabelOutlineRun } from "./early-outline-chapter";

describe(findEarlyOutlineChapter, () => {
  it("keeps a finished early chapter with its position and the goals that already plan its lessons", async () => {
    const [course, chapter, lesson, user] = await Promise.all([
      courseFixture(),
      libraryChapterFixture({ level: "beginner", outlineStatus: "completed" }),
      libraryLessonFixture(),
      userFixture(),
    ]);

    const goal = await goalFixture({ userId: user.id });
    const plan = await planFixture({ goalId: goal.id });

    await Promise.all([
      courseChapterFixture({
        chapterId: chapter.id,
        courseId: course.id,
        level: "beginner",
        position: 0,
      }),
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id }),
      planItemFixture({ lessonId: lesson.id, planId: plan.id, position: 0 }),
    ]);

    await expect(
      findEarlyOutlineChapter({ courseId: course.id, level: "beginner", nextPosition: 0 }),
    ).resolves.toStrictEqual({ chapterId: chapter.id, goalIds: [goal.id], position: 0 });

    await expect(
      findEarlyOutlineChapter({ courseId: course.id, level: "beginner", nextPosition: 1 }),
    ).resolves.toBeNull();
  });

  it("takes an unfinished early chapter out of the band, so the retry writes it again", async () => {
    const [course, chapter] = await Promise.all([
      courseFixture(),
      libraryChapterFixture({ level: "beginner", outlineStatus: "failed" }),
    ]);

    await courseChapterFixture({
      chapterId: chapter.id,
      courseId: course.id,
      level: "beginner",
      position: 0,
    });

    await expect(
      findEarlyOutlineChapter({ courseId: course.id, level: "beginner", nextPosition: 0 }),
    ).resolves.toBeNull();

    await expect(prisma.courseChapter.count({ where: { courseId: course.id } })).resolves.toBe(0);
  });
});

describe(relabelOutlineRun, () => {
  it("names the model that answered on the rows its run saved, and leaves other runs alone", async () => {
    const runId = `outline-run-${randomUUID()}`;

    const [chapter, lesson, skill, other] = await Promise.all([
      libraryChapterFixture({ model: "openai/gpt-6-sol", runId }),
      libraryLessonFixture({ model: "openai/gpt-6-sol", runId }),
      skillFixture({ model: "openai/gpt-6-sol", runId }),
      libraryLessonFixture({ model: "openai/gpt-6-sol" }),
    ]);

    await relabelOutlineRun({ model: "anthropic/claude-opus-5.5", runId });

    const [storedChapter, storedLesson, storedSkill, storedOther] = await Promise.all([
      prisma.chapter.findUniqueOrThrow({ where: { id: chapter.id } }),
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
      prisma.skill.findUniqueOrThrow({ where: { id: skill.id } }),
      prisma.lesson.findUniqueOrThrow({ where: { id: other.id } }),
    ]);

    expect([storedChapter.model, storedLesson.model, storedSkill.model]).toStrictEqual([
      "anthropic/claude-opus-5.5",
      "anthropic/claude-opus-5.5",
      "anthropic/claude-opus-5.5",
    ]);

    expect(storedOther.model).toBe("openai/gpt-6-sol");
  });
});
