import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  chapterSkillFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
  libraryLessonsFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { describe, expect, it } from "vitest";
import { loadSkillLessons } from "../../plans/_utils/planner-lessons";
import { findExamLibrary } from "./exam-library-skills";

async function taughtCourseFixture({ id, skillId }: { id: string; skillId: string }) {
  const course = await courseFixture({ id, language: "pt" });
  const chapter = await libraryChapterFixture({ homeCourseId: course.id, language: "pt" });
  const lessons = await libraryLessonsFixture(2, { homeChapterId: chapter.id, language: "pt" });

  await Promise.all([
    chapterSkillFixture({ chapterId: chapter.id, skillId }),
    ...lessons.map((lesson, position) =>
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position }),
    ),
  ]);

  return course;
}

describe("review: question-bank skills the frame's own course teaches", () => {
  it("keeps a question-bank skill in the frame course that teaches it instead of adding another course", async () => {
    const [blueprint, skill] = await Promise.all([
      examBlueprintFixture({ language: "pt" }),
      skillFixture({ language: "pt" }),
    ]);

    const [regimento, processo] = await Promise.all([
      taughtCourseFixture({ id: `00000000-${randomUUID().slice(9)}`, skillId: skill.id }),
      taughtCourseFixture({ id: `ffffffff-${randomUUID().slice(9)}`, skillId: skill.id }),
    ]);

    await itemFixture({ examBlueprintId: blueprint.id, language: "pt", skillId: skill.id });

    const library = await findExamLibrary({
      courseIdsByKey: { processo: processo.id },
      examBlueprintId: blueprint.id,
      language: "pt",
    });

    expect(regimento.id.localeCompare(processo.id)).toBeLessThan(0);
    expect(library.skills.find(({ id }) => id === skill.id)?.course).toBe("processo");
    expect(library.courses).toStrictEqual([]);
  });
});

describe("review: sizes match what the planner loads for an exam goal", () => {
  it("does not count a chapter's challenge lesson, which an exam plan never teaches", async () => {
    const [course, blueprint, skill] = await Promise.all([
      courseFixture({ language: "pt" }),
      examBlueprintFixture({ language: "pt" }),
      skillFixture({ language: "pt" }),
    ]);

    const chapter = await libraryChapterFixture({ homeCourseId: course.id, language: "pt" });

    const [lessons, challenge] = await Promise.all([
      libraryLessonsFixture(2, { homeChapterId: chapter.id, language: "pt" }),
      libraryLessonFixture({
        homeChapterId: chapter.id,
        identityKey: `challenge:${randomUUID()}`,
        language: "pt",
      }),
    ]);

    await Promise.all([
      chapterSkillFixture({ chapterId: chapter.id, skillId: skill.id }),
      prisma.courseChapter.create({
        data: { chapterId: chapter.id, courseId: course.id, level: "beginner", position: 0 },
      }),
      ...[...lessons, challenge].map((lesson, position) =>
        chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position }),
      ),
    ]);

    const [library, planned] = await Promise.all([
      findExamLibrary({
        courseIdsByKey: { subject: course.id },
        examBlueprintId: blueprint.id,
        language: "pt",
      }),
      loadSkillLessons({
        goal: { examBlueprintId: blueprint.id, kind: "exam" },
        skillCourses: new Map([[skill.id, [course.id]]]),
        skillIds: [skill.id],
        userId: null,
      }),
    ]);

    expect(planned).toHaveLength(2);
    expect(library.skills).toMatchObject([{ id: skill.id, lessons: planned.length }]);
  });

  it("does not count a foundation's quick lesson, which the planner never loads", async () => {
    const [physics, mathematics, blueprint, applied, foundation] = await Promise.all([
      courseFixture({ language: "pt" }),
      courseFixture({ language: "pt" }),
      examBlueprintFixture({ language: "pt" }),
      skillFixture({ language: "pt" }),
      skillFixture({ language: "pt" }),
    ]);

    const [physicsChapter, mathChapter] = await Promise.all([
      libraryChapterFixture({ homeCourseId: physics.id, language: "pt" }),
      libraryChapterFixture({ homeCourseId: mathematics.id, language: "pt" }),
    ]);

    const [physicsLessons, mathLessons, quick] = await Promise.all([
      libraryLessonsFixture(2, { homeChapterId: physicsChapter.id, language: "pt" }),
      libraryLessonsFixture(2, { homeChapterId: mathChapter.id, language: "pt" }),
      libraryLessonFixture({
        homeChapterId: mathChapter.id,
        identityKey: `quick:${foundation.id}`,
        language: "pt",
      }),
    ]);

    await Promise.all([
      chapterSkillFixture({ chapterId: physicsChapter.id, skillId: applied.id }),
      chapterSkillFixture({ chapterId: mathChapter.id, skillId: foundation.id }),
      prisma.courseChapter.create({
        data: {
          chapterId: mathChapter.id,
          courseId: mathematics.id,
          level: "beginner",
          position: 0,
        },
      }),
      ...physicsLessons.map((lesson, position) =>
        chapterLessonFixture({ chapterId: physicsChapter.id, lessonId: lesson.id, position }),
      ),
      ...mathLessons.map((lesson, position) =>
        chapterLessonFixture({ chapterId: mathChapter.id, lessonId: lesson.id, position }),
      ),
      lessonSkillFixture({ lessonId: quick.id, skillId: foundation.id }),
      prisma.skillPrerequisite.create({
        data: { prerequisiteId: foundation.id, skillId: applied.id },
      }),
    ]);

    const [library, planned] = await Promise.all([
      findExamLibrary({
        courseIdsByKey: { physics: physics.id },
        examBlueprintId: blueprint.id,
        language: "pt",
      }),
      loadSkillLessons({
        goal: { examBlueprintId: blueprint.id, kind: "exam" },
        skillCourses: new Map([[foundation.id, [mathematics.id]]]),
        skillIds: [foundation.id],
        userId: null,
      }),
    ]);

    expect(planned).toHaveLength(2);

    expect(library.skills.find(({ id }) => id === foundation.id)).toMatchObject({
      course: mathematics.id,
      lessons: planned.length,
    });
  });

  it("brings a foundation taught only through lesson tags with its course", async () => {
    const [physics, mathematics, blueprint, applied, foundation] = await Promise.all([
      courseFixture({ language: "pt" }),
      courseFixture({ language: "pt" }),
      examBlueprintFixture({ language: "pt" }),
      skillFixture({ language: "pt" }),
      skillFixture({ language: "pt" }),
    ]);

    const [physicsChapter, mathChapter] = await Promise.all([
      libraryChapterFixture({ homeCourseId: physics.id, language: "pt" }),
      libraryChapterFixture({ homeCourseId: mathematics.id, language: "pt" }),
    ]);

    const [physicsLessons, mathLessons] = await Promise.all([
      libraryLessonsFixture(2, { homeChapterId: physicsChapter.id, language: "pt" }),
      libraryLessonsFixture(3, { homeChapterId: mathChapter.id, language: "pt" }),
    ]);

    await Promise.all([
      chapterSkillFixture({ chapterId: physicsChapter.id, skillId: applied.id }),
      ...physicsLessons.map((lesson, position) =>
        chapterLessonFixture({ chapterId: physicsChapter.id, lessonId: lesson.id, position }),
      ),
      ...mathLessons.map((lesson, position) =>
        chapterLessonFixture({ chapterId: mathChapter.id, lessonId: lesson.id, position }),
      ),
      ...mathLessons
        .slice(0, 2)
        .map((lesson) => lessonSkillFixture({ lessonId: lesson.id, skillId: foundation.id })),
      prisma.skillPrerequisite.create({
        data: { prerequisiteId: foundation.id, skillId: applied.id },
      }),
    ]);

    const library = await findExamLibrary({
      courseIdsByKey: { physics: physics.id },
      examBlueprintId: blueprint.id,
      language: "pt",
    });

    expect(library.skills.find(({ id }) => id === foundation.id)).toMatchObject({
      course: mathematics.id,
      lessons: 2,
    });
  });
});
