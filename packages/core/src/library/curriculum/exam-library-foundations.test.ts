import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  chapterSkillFixture,
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonsFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { describe, expect, it } from "vitest";
import { loadSkillLessons } from "../../plans/_utils/planner-lessons";
import { findExamLibrary } from "./exam-library-skills";

async function placedChapterFixture({ courseId, lessons }: { courseId: string; lessons: number }) {
  const chapter = await libraryChapterFixture({ homeCourseId: courseId, language: "pt" });
  const rows = await libraryLessonsFixture(lessons, { homeChapterId: chapter.id, language: "pt" });

  await Promise.all([
    courseChapterFixture({ chapterId: chapter.id, courseId, position: 0 }),
    ...rows.map((lesson, position) =>
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position }),
    ),
  ]);

  return { chapter, lessons: rows };
}

describe("a foundation the frame's own course teaches", () => {
  it("keeps a lesson-tagged foundation in the frame course that teaches it instead of adding another course", async () => {
    const [physics, other, blueprint, applied, foundation] = await Promise.all([
      courseFixture({ id: `ffffffff-${randomUUID().slice(9)}`, language: "pt" }),
      courseFixture({ id: `00000000-${randomUUID().slice(9)}`, language: "pt" }),
      examBlueprintFixture({ language: "pt" }),
      skillFixture({ language: "pt" }),
      skillFixture({ language: "pt" }),
    ]);

    const [physicsPlace, otherPlace] = await Promise.all([
      placedChapterFixture({ courseId: physics.id, lessons: 2 }),
      placedChapterFixture({ courseId: other.id, lessons: 1 }),
    ]);

    await Promise.all([
      chapterSkillFixture({ chapterId: physicsPlace.chapter.id, skillId: applied.id }),
      lessonSkillFixture({ lessonId: physicsPlace.lessons[0]!.id, skillId: foundation.id }),
      lessonSkillFixture({ lessonId: otherPlace.lessons[0]!.id, skillId: foundation.id }),
      prisma.skillPrerequisite.create({
        data: { prerequisiteId: foundation.id, skillId: applied.id },
      }),
    ]);

    const [library, plannedInFrame] = await Promise.all([
      findExamLibrary({
        courseIdsByKey: { physics: physics.id },
        examBlueprintId: blueprint.id,
        language: "pt",
      }),
      loadSkillLessons({
        goal: { examBlueprintId: blueprint.id, kind: "exam" },
        skillCourses: new Map([[foundation.id, [physics.id]]]),
        skillIds: [foundation.id],
        userId: null,
      }),
    ]);

    expect(plannedInFrame).toHaveLength(1);
    expect(library.skills.find(({ id }) => id === foundation.id)?.course).toBe("physics");
    expect(library.courses).toStrictEqual([]);
  });
});
