import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { getNextSibling } from "./get-next-sibling";

describe("getNextSibling - lesson level", () => {
  let orgSlug: string;
  let courseId: number;
  let courseSlug: string;

  let chapter1Id: number;
  let chapter1Position: number;
  let chapter2Id: number;
  let chapter2Position: number;
  let chapter2Slug: string;

  let lesson1Position: number;
  let lesson2Slug: string;
  let lesson3Position: number;
  let lesson3Slug: string;

  beforeAll(async () => {
    const org = await organizationFixture({ kind: "brand" });
    orgSlug = org.slug;

    const course = await courseFixture({ isPublished: true, organizationId: org.id });
    courseId = course.id;
    courseSlug = course.slug;

    const [ch1, ch2] = await Promise.all([
      chapterFixture({ courseId, isPublished: true, organizationId: org.id, position: 0 }),
      chapterFixture({ courseId, isPublished: true, organizationId: org.id, position: 1 }),
    ]);

    chapter1Id = ch1.id;
    chapter1Position = ch1.position;
    chapter2Id = ch2.id;
    chapter2Position = ch2.position;
    chapter2Slug = ch2.slug;

    const [ls1, ls2] = await Promise.all([
      lessonFixture({ chapterId: ch1.id, isPublished: true, organizationId: org.id, position: 0 }),
      lessonFixture({ chapterId: ch1.id, isPublished: true, organizationId: org.id, position: 1 }),
    ]);

    lesson1Position = ls1.position;
    lesson2Slug = ls2.slug;

    const ls3 = await lessonFixture({
      chapterId: ch2.id,
      isPublished: true,
      organizationId: org.id,
      position: 0,
    });

    lesson3Position = ls3.position;
    lesson3Slug = ls3.slug;
  });

  test("returns next lesson in same chapter", async () => {
    const result = await getNextSibling({
      chapterId: chapter1Id,
      chapterPosition: chapter1Position,
      courseId,
      lessonPosition: lesson1Position,
      level: "lesson",
    });

    expect(result).toMatchObject({
      brandSlug: orgSlug,
      chapterSlug: expect.any(String),
      courseSlug,
      lessonSlug: lesson2Slug,
    });
  });

  test("returns first lesson of next chapter when last in current chapter", async () => {
    const result = await getNextSibling({
      chapterId: chapter1Id,
      chapterPosition: chapter1Position,
      courseId,
      lessonPosition: 1,
      level: "lesson",
    });

    expect(result).toMatchObject({
      brandSlug: orgSlug,
      chapterSlug: chapter2Slug,
      courseSlug,
      lessonSlug: lesson3Slug,
    });
  });

  test("returns null when last lesson in course", async () => {
    const result = await getNextSibling({
      chapterId: chapter2Id,
      chapterPosition: chapter2Position,
      courseId,
      lessonPosition: lesson3Position,
      level: "lesson",
    });

    expect(result).toBeNull();
  });

  test("skips unpublished lessons and chapters", async () => {
    const org = await organizationFixture({ kind: "brand" });
    const course = await courseFixture({ isPublished: true, organizationId: org.id });

    const [pubCh, , nextPubCh] = await Promise.all([
      chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: org.id,
        position: 0,
      }),
      chapterFixture({
        courseId: course.id,
        isPublished: false,
        organizationId: org.id,
        position: 1,
      }),
      chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: org.id,
        position: 2,
      }),
    ]);

    const [currentLesson, , nextLesson] = await Promise.all([
      lessonFixture({
        chapterId: pubCh.id,
        isPublished: true,
        organizationId: org.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: pubCh.id,
        isPublished: false,
        organizationId: org.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: nextPubCh.id,
        isPublished: true,
        organizationId: org.id,
        position: 0,
      }),
    ]);

    const result = await getNextSibling({
      chapterId: pubCh.id,
      chapterPosition: pubCh.position,
      courseId: course.id,
      lessonPosition: currentLesson.position,
      level: "lesson",
    });

    expect(result).toEqual(
      expect.objectContaining({
        lessonSlug: nextLesson.slug,
      }),
    );
  });
});

describe("getNextSibling - chapter level", () => {
  let orgSlug: string;
  let courseId: number;
  let courseSlug: string;
  let chapter2Slug: string;

  beforeAll(async () => {
    const org = await organizationFixture({ kind: "brand" });
    orgSlug = org.slug;

    const course = await courseFixture({ isPublished: true, organizationId: org.id });
    courseId = course.id;
    courseSlug = course.slug;

    const [, ch2] = await Promise.all([
      chapterFixture({ courseId, isPublished: true, organizationId: org.id, position: 0 }),
      chapterFixture({ courseId, isPublished: true, organizationId: org.id, position: 1 }),
    ]);

    chapter2Slug = ch2.slug;
  });

  test("returns next chapter in course", async () => {
    const result = await getNextSibling({
      chapterPosition: 0,
      courseId,
      level: "chapter",
    });

    expect(result).toMatchObject({
      brandSlug: orgSlug,
      chapterSlug: chapter2Slug,
      courseSlug,
    });
  });

  test("returns null when last chapter", async () => {
    const result = await getNextSibling({
      chapterPosition: 1,
      courseId,
      level: "chapter",
    });

    expect(result).toBeNull();
  });

  test("skips unpublished chapters", async () => {
    const org = await organizationFixture({ kind: "brand" });
    const course = await courseFixture({ isPublished: true, organizationId: org.id });

    const chapters = await Promise.all([
      chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: org.id,
        position: 0,
      }),
      chapterFixture({
        courseId: course.id,
        isPublished: false,
        organizationId: org.id,
        position: 1,
      }),
      chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: org.id,
        position: 2,
      }),
    ]);

    const result = await getNextSibling({
      chapterPosition: 0,
      courseId: course.id,
      level: "chapter",
    });

    expect(result).toEqual(
      expect.objectContaining({
        chapterSlug: chapters[2]?.slug,
      }),
    );
  });
});
