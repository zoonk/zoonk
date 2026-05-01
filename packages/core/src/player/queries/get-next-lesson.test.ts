import { randomUUID } from "node:crypto";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, it } from "vitest";
import { getNextLesson } from "./get-next-lesson";

describe(getNextLesson, () => {
  let orgId: string;
  let courseId: string;

  let chapter1Id: string;
  let chapter2Id: string;

  let lesson1Id: string;
  let lesson2Id: string;
  let lesson3Id: string;

  beforeAll(async () => {
    const org = await organizationFixture({ kind: "brand" });
    orgId = org.id;

    const course = await courseFixture({ isPublished: true, organizationId: orgId });
    courseId = course.id;

    const [ch1, ch2] = await Promise.all([
      chapterFixture({ courseId, isPublished: true, organizationId: orgId, position: 0 }),
      chapterFixture({ courseId, isPublished: true, organizationId: orgId, position: 1 }),
    ]);

    chapter1Id = ch1.id;
    chapter2Id = ch2.id;

    const [ls1, ls2] = await Promise.all([
      lessonFixture({
        chapterId: chapter1Id,
        isPublished: true,
        organizationId: orgId,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter1Id,
        isPublished: true,
        organizationId: orgId,
        position: 1,
      }),
    ]);

    lesson1Id = ls1.id;
    lesson2Id = ls2.id;

    const ls3 = await lessonFixture({
      chapterId: chapter2Id,
      isPublished: true,
      organizationId: orgId,
      position: 0,
    });

    lesson3Id = ls3.id;
  });

  it("returns next lesson in same chapter", async () => {
    const result = await getNextLesson(lesson1Id);
    expect(result).toStrictEqual({ id: lesson2Id, needsGeneration: false });
  });

  it("returns first lesson of next chapter when current is last in chapter", async () => {
    const result = await getNextLesson(lesson2Id);
    expect(result).toStrictEqual({ id: lesson3Id, needsGeneration: false });
  });

  it("returns null when on last lesson of course", async () => {
    const result = await getNextLesson(lesson3Id);
    expect(result).toBeNull();
  });

  it("returns null for non-existent lesson", async () => {
    const result = await getNextLesson(randomUUID());
    expect(result).toBeNull();
  });

  it("skips unpublished lessons", async () => {
    const testOrg = await organizationFixture({ kind: "brand" });
    const testCourse = await courseFixture({ isPublished: true, organizationId: testOrg.id });

    const testChapter = await chapterFixture({
      courseId: testCourse.id,
      isPublished: true,
      organizationId: testOrg.id,
      position: 0,
    });

    const [publishedLesson, , nextPublishedLesson] = await Promise.all([
      lessonFixture({
        chapterId: testChapter.id,
        isPublished: true,
        organizationId: testOrg.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: testChapter.id,
        isPublished: false,
        organizationId: testOrg.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: testChapter.id,
        isPublished: true,
        organizationId: testOrg.id,
        position: 2,
      }),
    ]);

    const result = await getNextLesson(publishedLesson.id);
    expect(result).toStrictEqual({ id: nextPublishedLesson.id, needsGeneration: false });
  });

  it("skips unpublished chapters", async () => {
    const testOrg = await organizationFixture({ kind: "brand" });
    const testCourse = await courseFixture({ isPublished: true, organizationId: testOrg.id });

    const [publishedCh, , nextPublishedCh] = await Promise.all([
      chapterFixture({
        courseId: testCourse.id,
        isPublished: true,
        organizationId: testOrg.id,
        position: 0,
      }),
      chapterFixture({
        courseId: testCourse.id,
        isPublished: false,
        organizationId: testOrg.id,
        position: 1,
      }),
      chapterFixture({
        courseId: testCourse.id,
        isPublished: true,
        organizationId: testOrg.id,
        position: 2,
      }),
    ]);

    const [currentLesson, , nextLesson] = await Promise.all([
      lessonFixture({
        chapterId: publishedCh.id,
        isPublished: true,
        organizationId: testOrg.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: publishedCh.id,
        isPublished: false,
        organizationId: testOrg.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: nextPublishedCh.id,
        isPublished: true,
        organizationId: testOrg.id,
        position: 0,
      }),
    ]);

    const result = await getNextLesson(currentLesson.id);
    expect(result).toStrictEqual({ id: nextLesson.id, needsGeneration: false });
  });

  describe("needsGeneration", () => {
    it("returns needsGeneration true when lesson is pending", async () => {
      const testOrg = await organizationFixture({ kind: "brand" });
      const testCourse = await courseFixture({ isPublished: true, organizationId: testOrg.id });

      const testChapter = await chapterFixture({
        courseId: testCourse.id,
        isPublished: true,
        organizationId: testOrg.id,
        position: 0,
      });

      const [currentLesson, pendingLesson] = await Promise.all([
        lessonFixture({
          chapterId: testChapter.id,
          isPublished: true,
          organizationId: testOrg.id,
          position: 0,
        }),
        lessonFixture({
          chapterId: testChapter.id,
          generationStatus: "pending",
          isPublished: true,
          organizationId: testOrg.id,
          position: 1,
        }),
      ]);

      const result = await getNextLesson(currentLesson.id);
      expect(result).toStrictEqual({ id: pendingLesson.id, needsGeneration: true });
    });

    it("returns needsGeneration true when lesson is failed", async () => {
      const testOrg = await organizationFixture({ kind: "brand" });
      const testCourse = await courseFixture({ isPublished: true, organizationId: testOrg.id });

      const testChapter = await chapterFixture({
        courseId: testCourse.id,
        isPublished: true,
        organizationId: testOrg.id,
        position: 0,
      });

      const [currentLesson, failedLesson] = await Promise.all([
        lessonFixture({
          chapterId: testChapter.id,
          isPublished: true,
          organizationId: testOrg.id,
          position: 0,
        }),
        lessonFixture({
          chapterId: testChapter.id,
          generationStatus: "failed",
          isPublished: true,
          organizationId: testOrg.id,
          position: 1,
        }),
      ]);

      const result = await getNextLesson(currentLesson.id);
      expect(result).toStrictEqual({ id: failedLesson.id, needsGeneration: true });
    });

    it("returns needsGeneration false when next lesson is completed", async () => {
      const testOrg = await organizationFixture({ kind: "brand" });
      const testCourse = await courseFixture({ isPublished: true, organizationId: testOrg.id });

      const testChapter = await chapterFixture({
        courseId: testCourse.id,
        isPublished: true,
        organizationId: testOrg.id,
        position: 0,
      });

      const [currentLesson, nextLesson] = await Promise.all([
        lessonFixture({
          chapterId: testChapter.id,
          isPublished: true,
          organizationId: testOrg.id,
          position: 0,
        }),
        lessonFixture({
          chapterId: testChapter.id,
          generationStatus: "completed",
          isPublished: true,
          organizationId: testOrg.id,
          position: 1,
        }),
      ]);

      const result = await getNextLesson(currentLesson.id);
      expect(result).toStrictEqual({ id: nextLesson.id, needsGeneration: false });
    });

    it("returns needsGeneration false when lesson generation is already in flight", async () => {
      const testOrg = await organizationFixture({ kind: "brand" });
      const testCourse = await courseFixture({ isPublished: true, organizationId: testOrg.id });

      const testChapter = await chapterFixture({
        courseId: testCourse.id,
        isPublished: true,
        organizationId: testOrg.id,
        position: 0,
      });

      const [currentLesson, runningLesson] = await Promise.all([
        lessonFixture({
          chapterId: testChapter.id,
          isPublished: true,
          organizationId: testOrg.id,
          position: 0,
        }),
        lessonFixture({
          chapterId: testChapter.id,
          generationStatus: "running",
          isPublished: true,
          kind: "explanation",
          organizationId: testOrg.id,
          position: 1,
        }),
      ]);

      const result = await getNextLesson(currentLesson.id);
      expect(result).toStrictEqual({ id: runningLesson.id, needsGeneration: false });
    });
  });
});
