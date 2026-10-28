import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { courseBandsFixture } from "@zoonk/testing/fixtures/library-chapters";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, it } from "vitest";
import { getCourseDetail } from "./get-course-detail";

describe(getCourseDetail, () => {
  it("brings a catalog course's example plan, a quarter hour a day to its end", async () => {
    const organization = await organizationFixture({ kind: "brand" });
    const course = await courseFixture({
      isPublished: true,
      organizationId: organization.id,
      visibility: "public",
    });

    await courseBandsFixture({
      courseId: course.id,
      levels: ["beginner", "intermediate", "advanced"],
    });

    const detail = await getCourseDetail({ courseId: course.id });

    expect(detail?.examplePlan).toMatchObject({ exam: null, pace: { minutes: 15 } });
  });

  it("is null for a course nobody can read", async () => {
    const course = await courseFixture({ isPublished: false });

    await expect(getCourseDetail({ courseId: course.id })).resolves.toBeNull();
  });
});
