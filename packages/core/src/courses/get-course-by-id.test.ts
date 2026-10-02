import { randomUUID } from "node:crypto";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { catalogCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getSession } from "../users/get-session";
import { getCourseById } from "./get-course-by-id";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

describe(getCourseById, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("serves a published brand course to everyone without reading the session", async () => {
    const { course, organization } = await catalogCourseFixture({ lessonCounts: [] });

    await expect(getCourseById({ courseId: course.id })).resolves.toMatchObject({
      id: course.id,
      organization: { id: organization.id },
    });

    expect(getSession).not.toHaveBeenCalled();
  });

  it("serves a private course to its owner only", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);
    const course = await courseFixture({ userId: owner.id, visibility: "private" });

    await expect(getCourseById({ courseId: course.id })).resolves.toBeNull();

    mockSession(other.id);
    await expect(getCourseById({ courseId: course.id })).resolves.toBeNull();

    mockSession(owner.id);

    await expect(getCourseById({ courseId: course.id })).resolves.toMatchObject({
      categories: [],
      id: course.id,
      organization: null,
    });
  });

  it("doesn't open other courses outside the catalog, even to the learner who made them", async () => {
    const [owner, brand] = await Promise.all([
      userFixture(),
      organizationFixture({ kind: "brand" }),
    ]);

    const [unbranded, unpublished] = await Promise.all([
      courseFixture({ isPublished: true, userId: owner.id }),
      courseFixture({ isPublished: false, organizationId: brand.id, userId: owner.id }),
    ]);

    mockSession(owner.id);

    const results = await Promise.all([
      getCourseById({ courseId: unbranded.id }),
      getCourseById({ courseId: unpublished.id }),
      getCourseById({ courseId: randomUUID() }),
    ]);

    expect(results).toStrictEqual([null, null, null]);
  });
});
