import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { chapterSlugExists } from "./chapter-slug";

describe("chapterSlugExists()", () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;
  let course: Awaited<ReturnType<typeof courseFixture>>;

  beforeAll(async () => {
    organization = await organizationFixture();
    course = await courseFixture({ organizationId: organization.id });
  });

  test("returns true when slug exists in the same course", async () => {
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    const exists = await chapterSlugExists({
      courseId: course.id,
      slug: chapter.slug,
    });

    expect(exists).toBe(true);
  });

  test("returns false when slug does not exist", async () => {
    const exists = await chapterSlugExists({
      courseId: course.id,
      slug: "non-existent-slug",
    });

    expect(exists).toBe(false);
  });

  test("returns false when slug exists but in a different course", async () => {
    const otherCourse = await courseFixture({
      organizationId: organization.id,
    });

    const chapter = await chapterFixture({
      courseId: otherCourse.id,
      language: otherCourse.language,
      organizationId: organization.id,
    });

    const exists = await chapterSlugExists({
      courseId: course.id,
      slug: chapter.slug,
    });

    expect(exists).toBe(false);
  });
});
