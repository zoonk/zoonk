import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, it } from "vitest";
import { getNextChapterInCourse } from "./get-next-chapter-in-course";

describe(getNextChapterInCourse, () => {
  let orgSlug: string;
  let courseId: string;
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

  it("returns next chapter in course", async () => {
    const result = await getNextChapterInCourse({ chapterPosition: 0, courseId });

    expect(result).toMatchObject({ brandSlug: orgSlug, chapterSlug: chapter2Slug, courseSlug });
  });

  it("returns null when last chapter", async () => {
    const result = await getNextChapterInCourse({ chapterPosition: 1, courseId });

    expect(result).toBeNull();
  });

  it("skips unpublished chapters", async () => {
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

    const result = await getNextChapterInCourse({ chapterPosition: 0, courseId: course.id });

    expect(result).toStrictEqual(expect.objectContaining({ chapterSlug: chapters[2]?.slug }));
  });
});
