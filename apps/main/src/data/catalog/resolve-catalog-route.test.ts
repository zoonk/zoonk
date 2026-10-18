import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, it } from "vitest";
import {
  resolveChapterRoute,
  resolveCourseRoute,
  resolveLessonRoute,
} from "./resolve-catalog-route";

async function publishedCourse() {
  const org = await organizationFixture({ kind: "brand" });
  const course = await courseFixture({ isPublished: true, organizationId: org.id });
  return { course, courseHref: `/b/${org.slug}/c/${course.slug}`, org };
}

/** A course with one Library chapter holding one lesson, like the outline writer leaves it. */
async function libraryCourse() {
  const { course, courseHref, org } = await publishedCourse();

  const [first, second, lesson] = await Promise.all([
    libraryChapterFixture({ homeCourseId: course.id }),
    libraryChapterFixture({ homeCourseId: course.id }),
    libraryLessonFixture(),
  ]);

  await Promise.all([
    courseChapterFixture({ chapterId: first.id, courseId: course.id, position: 0 }),
    courseChapterFixture({ chapterId: second.id, courseId: course.id, position: 1 }),
    chapterLessonFixture({ chapterId: second.id, lessonId: lesson.id, position: 0 }),
  ]);

  const params = { brandSlug: org.slug, courseSlug: course.slug };
  return { chapter: second, course, courseHref, lesson, params };
}

describe(resolveCourseRoute, () => {
  it("returns not found for a course that doesn't exist", async () => {
    await expect(
      resolveCourseRoute({ brandSlug: "missing-brand", courseSlug: "missing-course" }),
    ).resolves.toStrictEqual({ kind: "notFound" });
  });

  it("uses the Library page for a course whose outline isn't written yet", async () => {
    const { course, org } = await publishedCourse();
    const route = await resolveCourseRoute({ brandSlug: org.slug, courseSlug: course.slug });

    expect(route).toMatchObject({ kind: "library", outline: { levels: [] } });
  });
});

describe(resolveChapterRoute, () => {
  it("finds a Library chapter with its number in the course", async () => {
    const { chapter, params } = await libraryCourse();
    const route = await resolveChapterRoute({ ...params, chapterSlug: chapter.slug });

    expect(route).toMatchObject({
      chapter: { id: chapter.id },
      kind: "library",
      number: 2,
      total: 2,
    });
  });

  it("moves a missing chapter of an existing course to the course page", async () => {
    const { courseHref, params } = await libraryCourse();

    await expect(
      resolveChapterRoute({ ...params, chapterSlug: "deleted-chapter" }),
    ).resolves.toStrictEqual({ href: courseHref, kind: "redirect" });
  });

  it("moves a chapter URL of a course without an outline to the course page", async () => {
    const { course, courseHref, org } = await publishedCourse();

    await expect(
      resolveChapterRoute({ brandSlug: org.slug, chapterSlug: "old", courseSlug: course.slug }),
    ).resolves.toStrictEqual({ href: courseHref, kind: "redirect" });
  });

  it("returns not found when the course doesn't exist", async () => {
    await expect(
      resolveChapterRoute({ brandSlug: "missing", chapterSlug: "x", courseSlug: "missing" }),
    ).resolves.toStrictEqual({ kind: "notFound" });
  });
});

describe(resolveLessonRoute, () => {
  it("finds a Library lesson in its chapter", async () => {
    const { chapter, lesson, params } = await libraryCourse();

    const route = await resolveLessonRoute({
      ...params,
      chapterSlug: chapter.slug,
      lessonSlug: lesson.slug,
    });

    expect(route).toMatchObject({
      chapter: { id: chapter.id },
      kind: "library",
      lesson: { id: lesson.id },
    });
  });

  it("moves a missing lesson of an existing chapter to the course page", async () => {
    const { chapter, courseHref, params } = await libraryCourse();

    await expect(
      resolveLessonRoute({ ...params, chapterSlug: chapter.slug, lessonSlug: "deleted" }),
    ).resolves.toStrictEqual({ href: courseHref, kind: "redirect" });
  });

  it("moves a lesson of a missing chapter to the course page", async () => {
    const { courseHref, params } = await libraryCourse();

    await expect(
      resolveLessonRoute({ ...params, chapterSlug: "deleted", lessonSlug: "deleted" }),
    ).resolves.toStrictEqual({ href: courseHref, kind: "redirect" });
  });
});
