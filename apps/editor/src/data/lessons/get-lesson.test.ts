import { ErrorCode } from "@/lib/app-error";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { memberFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { getLesson } from "./get-lesson";

describe("unauthenticated users", () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;
  let lesson: Awaited<ReturnType<typeof lessonFixture>>;

  beforeAll(async () => {
    organization = await organizationFixture();
    course = await courseFixture({ organizationId: organization.id });
    chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });
    lesson = await lessonFixture({
      chapterId: chapter.id,
      language: chapter.language,
      organizationId: organization.id,
    });
  });

  test("returns Forbidden", async () => {
    const result = await getLesson({
      chapterSlug: chapter.slug,
      courseSlug: course.slug,
      headers: new Headers(),
      language: lesson.language,
      lessonSlug: lesson.slug,
      orgSlug: organization.slug,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("members", () => {
  test("returns Forbidden", async () => {
    const { organization, user } = await memberFixture({ role: "member" });
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    const [headers, lesson] = await Promise.all([
      signInAs(user.email, user.password),
      lessonFixture({
        chapterId: chapter.id,
        language: chapter.language,
        organizationId: organization.id,
      }),
    ]);

    const result = await getLesson({
      chapterSlug: chapter.slug,
      courseSlug: course.slug,
      headers,
      language: lesson.language,
      lessonSlug: lesson.slug,
      orgSlug: organization.slug,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("admins", () => {
  let organization: Awaited<ReturnType<typeof memberFixture>>["organization"];
  let headers: Headers;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;
  let lesson: Awaited<ReturnType<typeof lessonFixture>>;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    organization = fixture.organization;

    course = await courseFixture({
      language: "en",
      organizationId: organization.id,
    });

    chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    [headers, lesson] = await Promise.all([
      signInAs(fixture.user.email, fixture.user.password),
      lessonFixture({
        chapterId: chapter.id,
        language: chapter.language,
        organizationId: fixture.organization.id,
      }),
    ]);
  });

  test("gets lesson by slug successfully", async () => {
    const result = await getLesson({
      chapterSlug: chapter.slug,
      courseSlug: course.slug,
      headers,
      language: lesson.language,
      lessonSlug: lesson.slug,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(lesson.id);
    expect(result.data?.title).toBe(lesson.title);
  });

  test("returns null when lesson not found", async () => {
    const result = await getLesson({
      chapterSlug: chapter.slug,
      courseSlug: course.slug,
      headers,
      language: lesson.language,
      lessonSlug: "non-existent-slug",
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  test("returns null when language doesn't match", async () => {
    const result = await getLesson({
      chapterSlug: chapter.slug,
      courseSlug: course.slug,
      headers,
      language: "xx",
      lessonSlug: lesson.slug,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  test("returns null when chapter doesn't match", async () => {
    const result = await getLesson({
      chapterSlug: "non-existent-chapter",
      courseSlug: course.slug,
      headers,
      language: lesson.language,
      lessonSlug: lesson.slug,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  test("returns the correct lesson when same slug exists in different chapters", async () => {
    const chapter2 = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    const lesson2 = await lessonFixture({
      chapterId: chapter2.id,
      language: chapter2.language,
      organizationId: organization.id,
      slug: lesson.slug,
    });

    const result = await getLesson({
      chapterSlug: chapter2.slug,
      courseSlug: course.slug,
      headers,
      language: lesson2.language,
      lessonSlug: lesson2.slug,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(lesson2.id);
    expect(result.data?.chapterId).toBe(chapter2.id);
  });

  test("returns Forbidden for lesson in different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });

    const otherChapter = await chapterFixture({
      courseId: otherCourse.id,
      language: otherCourse.language,
      organizationId: otherOrg.id,
    });

    const otherLesson = await lessonFixture({
      chapterId: otherChapter.id,
      language: otherChapter.language,
      organizationId: otherOrg.id,
    });

    const result = await getLesson({
      chapterSlug: otherChapter.slug,
      courseSlug: otherCourse.slug,
      headers,
      language: otherLesson.language,
      lessonSlug: otherLesson.slug,
      orgSlug: otherOrg.slug,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});
