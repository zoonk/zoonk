import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { memberFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { chapterSlugExists } from "./chapter-slug";

describe("chapterSlugExists()", () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let headers: Headers;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    organization = fixture.organization;

    [headers, course] = await Promise.all([
      signInAs(fixture.user.email, fixture.user.password),
      courseFixture({ organizationId: fixture.organization.id }),
    ]);
  });

  test("returns true when slug exists in the same course", async () => {
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    const exists = await chapterSlugExists({
      courseId: course.id,
      headers,
      slug: chapter.slug,
    });

    expect(exists).toBe(true);
  });

  test("returns false when slug does not exist", async () => {
    const exists = await chapterSlugExists({
      courseId: course.id,
      headers,
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
      headers,
      slug: chapter.slug,
    });

    expect(exists).toBe(false);
  });

  test("returns false when the user cannot update the target course", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });
    const otherChapter = await chapterFixture({
      courseId: otherCourse.id,
      language: otherCourse.language,
      organizationId: otherOrg.id,
    });

    const exists = await chapterSlugExists({
      courseId: otherCourse.id,
      headers,
      slug: otherChapter.slug,
    });

    expect(exists).toBe(false);
  });
});
