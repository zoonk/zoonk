import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { getChapterHomeRoute, getLessonHomeRoute } from "./get-home-route";

async function publishedHomeCourse() {
  const org = await organizationFixture({ kind: "brand" });
  const course = await courseFixture({ isPublished: true, language: "pt", organizationId: org.id });
  return { course, org };
}

describe(getChapterHomeRoute, () => {
  it("returns the URL parts of the chapter in the course it was made for", async () => {
    const { course, org } = await publishedHomeCourse();
    const chapter = await libraryChapterFixture({ homeCourseId: course.id });

    await expect(getChapterHomeRoute({ chapterId: chapter.id })).resolves.toStrictEqual({
      brandSlug: org.slug,
      chapterSlug: chapter.slug,
      courseSlug: course.slug,
      language: "pt",
    });
  });

  it("returns null when the home course isn't published", async () => {
    const org = await organizationFixture({ kind: "brand" });
    const course = await courseFixture({ isPublished: false, organizationId: org.id });
    const chapter = await libraryChapterFixture({ homeCourseId: course.id });

    await expect(getChapterHomeRoute({ chapterId: chapter.id })).resolves.toBeNull();
  });

  it("returns null for a chapter without a home", async () => {
    const chapter = await libraryChapterFixture();
    await expect(getChapterHomeRoute({ chapterId: chapter.id })).resolves.toBeNull();
  });
});

describe(getLessonHomeRoute, () => {
  it("returns the URL parts of the lesson in its home chapter and course", async () => {
    const { course, org } = await publishedHomeCourse();
    const chapter = await libraryChapterFixture({ homeCourseId: course.id });
    const lesson = await libraryLessonFixture({ homeChapterId: chapter.id });

    await expect(getLessonHomeRoute({ lessonId: lesson.id })).resolves.toStrictEqual({
      brandSlug: org.slug,
      chapterSlug: chapter.slug,
      courseSlug: course.slug,
      language: "pt",
      lessonSlug: lesson.slug,
    });
  });

  it("returns null for a private lesson", async () => {
    const [{ course }, owner] = await Promise.all([publishedHomeCourse(), userFixture()]);
    const chapter = await libraryChapterFixture({ homeCourseId: course.id });

    const lesson = await libraryLessonFixture({
      homeChapterId: chapter.id,
      ownerId: owner.id,
      visibility: "private",
    });

    await expect(getLessonHomeRoute({ lessonId: lesson.id })).resolves.toBeNull();
  });

  it("returns null for a lesson without a home chapter", async () => {
    const lesson = await libraryLessonFixture();
    await expect(getLessonHomeRoute({ lessonId: lesson.id })).resolves.toBeNull();
  });
});
