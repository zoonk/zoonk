import { ErrorCode } from "@/lib/app-error";
import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseCategoryFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonAttrs, lessonFixture } from "@zoonk/testing/fixtures/lessons";
import {
  aiOrganizationFixture,
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { createLesson } from "./create-lesson";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    const result = await createLesson({
      ...lessonAttrs({
        chapterId: chapter.id,
        organizationId: organization.id,
      }),
      chapterId: chapter.id,
      headers: new Headers(),
      position: 0,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("members", () => {
  test("returns Forbidden", async () => {
    const { organization, user } = await memberFixture({ role: "member" });

    const course = await courseFixture({ organizationId: organization.id });
    const [headers, chapter] = await Promise.all([
      signInAs(user.email, user.password),
      chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: organization.id,
      }),
    ]);

    const result = await createLesson({
      ...lessonAttrs({
        chapterId: chapter.id,
        organizationId: organization.id,
      }),
      chapterId: chapter.id,
      headers,
      position: 0,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("admins", () => {
  let organization: Awaited<ReturnType<typeof memberFixture>>["organization"];
  let headers: Headers;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    organization = fixture.organization;

    const course = await courseFixture({
      organizationId: fixture.organization.id,
    });
    [headers, chapter] = await Promise.all([
      signInAs(fixture.user.email, fixture.user.password),
      chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: fixture.organization.id,
      }),
    ]);
  });

  test("creates lesson successfully", async () => {
    const attrs = lessonAttrs({
      chapterId: chapter.id,
      organizationId: organization.id,
    });

    const result = await createLesson({
      ...attrs,
      chapterId: chapter.id,
      headers,
      position: 0,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
    expect(result.data?.title).toBe(attrs.title);
    expect(result.data?.description).toBe(attrs.description);
    expect(result.data?.organizationId).toBe(organization.id);
    expect(result.data?.chapterId).toBe(chapter.id);
    expect(result.data?.language).toBe(chapter.language);
    expect(result.data?.kind).toBe("custom");
  });

  describe("lesson kind based on org and category", () => {
    let aiOrg: Awaited<ReturnType<typeof aiOrganizationFixture>>;
    let aiHeaders: Headers;

    beforeAll(async () => {
      const [org, fixture] = await Promise.all([
        aiOrganizationFixture(),
        memberFixture({ role: "admin" }),
      ]);

      aiOrg = org;

      const [, testHeaders] = await Promise.all([
        prisma.member.create({
          data: {
            organizationId: aiOrg.id,
            role: "admin",
            userId: Number(fixture.user.id),
          },
        }),
        signInAs(fixture.user.email, fixture.user.password),
      ]);

      aiHeaders = testHeaders;
    });

    test("sets kind to 'custom' for non-AI org", async () => {
      const course = await courseFixture({ organizationId: organization.id });
      const newChapter = await chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: organization.id,
      });

      const result = await createLesson({
        ...lessonAttrs({
          chapterId: newChapter.id,
          organizationId: organization.id,
        }),
        chapterId: newChapter.id,
        headers,
        position: 0,
      });

      expect(result.error).toBeNull();
      expect(result.data?.kind).toBe("custom");
    });

    test("sets kind to 'language' for AI org with languages category", async () => {
      const aiCourse = await courseFixture({ organizationId: aiOrg.id });

      const [, aiChapter] = await Promise.all([
        courseCategoryFixture({ category: "languages", courseId: aiCourse.id }),
        chapterFixture({
          courseId: aiCourse.id,
          language: aiCourse.language,
          organizationId: aiOrg.id,
        }),
      ]);

      const result = await createLesson({
        ...lessonAttrs({
          chapterId: aiChapter.id,
          organizationId: aiOrg.id,
        }),
        chapterId: aiChapter.id,
        headers: aiHeaders,
        position: 0,
      });

      expect(result.error).toBeNull();
      expect(result.data?.kind).toBe("language");
    });

    test("sets kind to 'core' for AI org without languages category", async () => {
      const aiCourse = await courseFixture({ organizationId: aiOrg.id });

      const [, aiChapter] = await Promise.all([
        courseCategoryFixture({ category: "programming", courseId: aiCourse.id }),
        chapterFixture({
          courseId: aiCourse.id,
          language: aiCourse.language,
          organizationId: aiOrg.id,
        }),
      ]);

      const result = await createLesson({
        ...lessonAttrs({
          chapterId: aiChapter.id,
          organizationId: aiOrg.id,
        }),
        chapterId: aiChapter.id,
        headers: aiHeaders,
        position: 0,
      });

      expect(result.error).toBeNull();
      expect(result.data?.kind).toBe("core");
    });

    test("sets kind to 'core' for AI org with no categories", async () => {
      const aiCourse = await courseFixture({ organizationId: aiOrg.id });

      const aiChapter = await chapterFixture({
        courseId: aiCourse.id,
        language: aiCourse.language,
        organizationId: aiOrg.id,
      });

      const result = await createLesson({
        ...lessonAttrs({
          chapterId: aiChapter.id,
          organizationId: aiOrg.id,
        }),
        chapterId: aiChapter.id,
        headers: aiHeaders,
        position: 0,
      });

      expect(result.error).toBeNull();
      expect(result.data?.kind).toBe("core");
    });
  });

  test("normalizes slug", async () => {
    const attrs = lessonAttrs({
      chapterId: chapter.id,
      organizationId: organization.id,
    });

    const result = await createLesson({
      ...attrs,
      chapterId: chapter.id,
      headers,
      position: 0,
      slug: "My Test Lesson!",
    });

    expect(result.error).toBeNull();
    expect(result.data?.slug).toBe("my-test-lesson");
  });

  test("normalizes title for search", async () => {
    const attrs = lessonAttrs({
      chapterId: chapter.id,
      organizationId: organization.id,
    });

    const result = await createLesson({
      ...attrs,
      chapterId: chapter.id,
      headers,
      position: 0,
      title: "Introdução à Programação",
    });

    expect(result.error).toBeNull();
    expect(result.data?.normalizedTitle).toBe("introducao a programacao");
  });

  test("returns Chapter not found", async () => {
    const result = await createLesson({
      ...lessonAttrs({
        chapterId: 999_999,
        organizationId: organization.id,
      }),
      chapterId: 999_999,
      headers,
      position: 0,
    });

    expect(result.error?.message).toBe(ErrorCode.chapterNotFound);
    expect(result.data).toBeNull();
  });

  test("don't allow to create lesson for a different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });
    const otherChapter = await chapterFixture({
      courseId: otherCourse.id,
      language: otherCourse.language,
      organizationId: otherOrg.id,
    });

    const result = await createLesson({
      ...lessonAttrs({
        chapterId: otherChapter.id,
        organizationId: otherOrg.id,
      }),
      chapterId: otherChapter.id,
      headers,
      position: 0,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });

  test("returns error when slug already exists for same chapter", async () => {
    const attrs = lessonAttrs({
      chapterId: chapter.id,
      organizationId: organization.id,
    });

    await createLesson({
      ...attrs,
      chapterId: chapter.id,
      headers,
      position: 0,
    });

    const result = await createLesson({
      ...attrs,
      chapterId: chapter.id,
      headers,
      position: 1,
    });

    expect(result.error).not.toBeNull();
  });

  test("allows same slug in different chapters", async () => {
    const newCourse = await courseFixture({ organizationId: organization.id });
    const [chapter1, chapter2] = await Promise.all([
      chapterFixture({
        courseId: newCourse.id,
        language: newCourse.language,
        organizationId: organization.id,
      }),
      chapterFixture({
        courseId: newCourse.id,
        language: newCourse.language,
        organizationId: organization.id,
      }),
    ]);

    const attrs = lessonAttrs({
      chapterId: chapter1.id,
      organizationId: organization.id,
    });

    const [result1, result2] = await Promise.all([
      createLesson({
        ...attrs,
        chapterId: chapter1.id,
        headers,
        position: 0,
      }),
      createLesson({
        ...attrs,
        chapterId: chapter2.id,
        headers,
        position: 0,
      }),
    ]);

    expect(result1.error).toBeNull();
    expect(result2.error).toBeNull();
    expect(result1.data?.slug).toBe(result2.data?.slug);
  });

  test("creates lesson at correct position", async () => {
    const attrs = lessonAttrs({
      chapterId: chapter.id,
      organizationId: organization.id,
    });
    const expectedPosition = 5;

    const result = await createLesson({
      ...attrs,
      chapterId: chapter.id,
      headers,
      position: expectedPosition,
    });

    expect(result.error).toBeNull();
    expect(result.data?.position).toBe(expectedPosition);
  });

  test("shifts existing lessons when creating at position 0", async () => {
    const newCourse = await courseFixture({ organizationId: organization.id });
    const newChapter = await chapterFixture({
      courseId: newCourse.id,
      language: newCourse.language,
      organizationId: organization.id,
    });

    const [lesson1, lesson2] = await Promise.all([
      lessonFixture({
        chapterId: newChapter.id,
        language: newChapter.language,
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: newChapter.id,
        language: newChapter.language,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    const result = await createLesson({
      ...lessonAttrs({
        chapterId: newChapter.id,
        organizationId: organization.id,
      }),
      chapterId: newChapter.id,
      headers,
      position: 0,
    });

    expect(result.error).toBeNull();

    const lessons = await prisma.lesson.findMany({
      orderBy: { position: "asc" },
      where: { chapterId: newChapter.id },
    });

    expect(lessons.length).toBe(3);
    expect(lessons[0]?.id).toBe(result.data?.id);
    expect(lessons[0]?.position).toBe(0);
    expect(lessons[1]?.id).toBe(lesson1.id);
    expect(lessons[1]?.position).toBe(1);
    expect(lessons[2]?.id).toBe(lesson2.id);
    expect(lessons[2]?.position).toBe(2);
  });

  test("shifts only lessons after insertion point", async () => {
    const newCourse = await courseFixture({ organizationId: organization.id });
    const newChapter = await chapterFixture({
      courseId: newCourse.id,
      language: newCourse.language,
      organizationId: organization.id,
    });

    const [lesson1, lesson2, lesson3] = await Promise.all([
      lessonFixture({
        chapterId: newChapter.id,
        language: newChapter.language,
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: newChapter.id,
        language: newChapter.language,
        organizationId: organization.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: newChapter.id,
        language: newChapter.language,
        organizationId: organization.id,
        position: 2,
      }),
    ]);

    const result = await createLesson({
      ...lessonAttrs({
        chapterId: newChapter.id,
        organizationId: organization.id,
      }),
      chapterId: newChapter.id,
      headers,
      position: 1,
    });

    expect(result.error).toBeNull();

    const lessons = await prisma.lesson.findMany({
      orderBy: { position: "asc" },
      where: { chapterId: newChapter.id },
    });

    expect(lessons.length).toBe(4);
    expect(lessons[0]?.id).toBe(lesson1.id);
    expect(lessons[0]?.position).toBe(0);
    expect(lessons[1]?.id).toBe(result.data?.id);
    expect(lessons[1]?.position).toBe(1);
    expect(lessons[2]?.id).toBe(lesson2.id);
    expect(lessons[2]?.position).toBe(2);
    expect(lessons[3]?.id).toBe(lesson3.id);
    expect(lessons[3]?.position).toBe(3);
  });

  test("does not shift lessons when creating at end", async () => {
    const newCourse = await courseFixture({ organizationId: organization.id });
    const newChapter = await chapterFixture({
      courseId: newCourse.id,
      language: newCourse.language,
      organizationId: organization.id,
    });

    const [lesson1, lesson2] = await Promise.all([
      lessonFixture({
        chapterId: newChapter.id,
        language: newChapter.language,
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: newChapter.id,
        language: newChapter.language,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    const result = await createLesson({
      ...lessonAttrs({
        chapterId: newChapter.id,
        organizationId: organization.id,
      }),
      chapterId: newChapter.id,
      headers,
      position: 2,
    });

    expect(result.error).toBeNull();

    const lessons = await prisma.lesson.findMany({
      orderBy: { position: "asc" },
      where: { chapterId: newChapter.id },
    });

    expect(lessons.length).toBe(3);
    expect(lessons[0]?.id).toBe(lesson1.id);
    expect(lessons[0]?.position).toBe(0);
    expect(lessons[1]?.id).toBe(lesson2.id);
    expect(lessons[1]?.position).toBe(1);
    expect(lessons[2]?.id).toBe(result.data?.id);
    expect(lessons[2]?.position).toBe(2);
  });

  test("handles concurrent creations at same position without duplicate positions", async () => {
    const newCourse = await courseFixture({ organizationId: organization.id });
    const newChapter = await chapterFixture({
      courseId: newCourse.id,
      language: newCourse.language,
      organizationId: organization.id,
    });

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        createLesson({
          ...lessonAttrs({
            chapterId: newChapter.id,
            organizationId: organization.id,
          }),
          chapterId: newChapter.id,
          headers,
          position: 0,
        }),
      ),
    );

    for (const result of results) {
      expect(result.error).toBeNull();
    }

    const lessons = await prisma.lesson.findMany({
      orderBy: { position: "asc" },
      where: { chapterId: newChapter.id },
    });

    expect(lessons.length).toBe(5);

    const positions = lessons.map((lesson) => lesson.position);
    const uniquePositions = new Set(positions);
    expect(uniquePositions.size).toBe(5);

    const sortedPositions = [...positions].toSorted((a, b) => a - b);
    expect(sortedPositions).toEqual([0, 1, 2, 3, 4]);
  });

  describe("isPublished behavior", () => {
    test("lesson is published when chapter is unpublished", async () => {
      const course = await courseFixture({ organizationId: organization.id });
      const unpublishedChapter = await chapterFixture({
        courseId: course.id,
        isPublished: false,
        language: course.language,
        organizationId: organization.id,
      });

      const result = await createLesson({
        ...lessonAttrs({
          chapterId: unpublishedChapter.id,
          organizationId: organization.id,
        }),
        chapterId: unpublishedChapter.id,
        headers,
        position: 0,
      });

      expect(result.error).toBeNull();
      expect(result.data?.isPublished).toBeTruthy();
    });

    test("lesson is unpublished when chapter is published", async () => {
      const course = await courseFixture({ organizationId: organization.id });
      const publishedChapter = await chapterFixture({
        courseId: course.id,
        isPublished: true,
        language: course.language,
        organizationId: organization.id,
      });

      const result = await createLesson({
        ...lessonAttrs({
          chapterId: publishedChapter.id,
          organizationId: organization.id,
        }),
        chapterId: publishedChapter.id,
        headers,
        position: 0,
      });

      expect(result.error).toBeNull();
      expect(result.data?.isPublished).toBeFalsy();
    });
  });
});
